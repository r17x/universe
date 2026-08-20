import { Array as Arr, Clock, Context, Effect, Layer, Option, Ref, Schema } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import { ulid, isUlid, SessionId } from "./Ulid";
import type { SessionId as SessionIdType } from "./Ulid";
import { Config } from "./Config";
import { EventLog, EventLogError } from "./EventLog";
import { MachineLoader, type MachineConfig } from "./MachineLoader";
import { MemoryStore } from "./MemoryStore";
import type { MemoryNode } from "./MemoryParser";
import { scaleOrder } from "./MemoryParser";
import { DirtyBits } from "./DirtyBits";
import { GuardEvaluator } from "./guard";
import { $is as $isGuard } from "./protocol.GuardResult";
import {
  Advanced,
  LoopedBack,
  Completed,
  Blocked,
  PhaseInfo as mkPhaseInfo,
} from "./protocol.EvalResult";
import type { EvalInput, StartResult, EvalResult } from "./protocol.EvalResult";
import { deriveState } from "./protocol.SessionState";

const STOP_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "that",
  "this",
  "will",
  "can",
  "not",
  "but",
  "has",
  "have",
  "was",
  "are",
  "been",
]);

export class PhaseEngineError extends Schema.TaggedErrorClass<PhaseEngineError>()(
  "PhaseEngineError",
  {
    message: Schema.String,
  },
) {}

export interface PhaseEngineContract {
  readonly start: (task: string) => Effect.Effect<StartResult, PhaseEngineError | EventLogError>;
  readonly draft: (task: string) => Effect.Effect<SessionIdType, EventLogError>;
  readonly eval: (input: EvalInput) => Effect.Effect<EvalResult, PhaseEngineError | EventLogError>;
  readonly observe: (text: string, sessionId: SessionIdType) => Effect.Effect<void, EventLogError>;
  readonly resume: (
    sessionId: SessionIdType,
  ) => Effect.Effect<EvalResult, PhaseEngineError | EventLogError>;
  readonly fail: (
    sessionId: SessionIdType,
    reason: string,
  ) => Effect.Effect<
    {
      readonly compensations: ReadonlyArray<{
        readonly phase: string;
        readonly action: string;
        readonly result: "success" | "failed";
      }>;
    },
    PhaseEngineError | EventLogError
  >;
}

export class PhaseEngine extends Context.Service<PhaseEngine, PhaseEngineContract>()(
  "@anakmagang/PhaseEngine",
) {
  static readonly layer = Layer.effect(
    PhaseEngine,
    Effect.gen(function* () {
      const config = yield* Config;
      const loader = yield* MachineLoader;
      const eventLog = yield* EventLog;
      const store = yield* MemoryStore;
      const dirtyBits = yield* DirtyBits;
      const guardEvaluator = yield* GuardEvaluator;
      const spawner = yield* ChildProcessSpawner;

      const machine = yield* loader.loadFromFile(config.configPath);

      const now = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString());

      const sizePresetKeys = Object.keys(machine.size_presets ?? {});
      const defaultSize = sizePresetKeys[0];
      const sizeOptions = sizePresetKeys.join("|");

      const computeActivePhases = (size: string) => {
        const allPhases = machine.phases;
        const presets = machine.size_presets;
        if (!presets) return allPhases;

        const preset = presets[size];
        if (!preset) return allPhases;

        if (preset.phases) {
          const activePhases = preset.phases;
          if (activePhases.includes("all")) return allPhases;
          return Arr.filter(allPhases, (p) => activePhases.includes(p.id));
        }

        if (preset.skip) {
          const skipSet = new Set(preset.skip);
          return Arr.filter(allPhases, (p) => !skipSet.has(p.id));
        }

        return allPhases;
      };

      const toPhaseInfo = (phase: (typeof MachineConfig.Type)["phases"][number]) =>
        mkPhaseInfo({
          id: phase.id,
          name: phase.name,
          number: machine.phases.indexOf(phase) + 1,
        });

      const generateSessionId = ulid;

      const initializeSession = Effect.fn("PhaseEngine.initializeSession")(function* (
        sessionId: SessionIdType,
        task: string,
      ) {
        const ts = yield* now;
        const firstPhase = yield* Arr.head(machine.phases).pipe(
          Effect.fromOption,
          Effect.mapError(
            () => new PhaseEngineError({ message: "Machine has no phases configured" }),
          ),
        );
        yield* eventLog.appendManifest(sessionId, {
          type: "session_init",
          phase: firstPhase.id,
          ts,
        });

        yield* dirtyBits
          .snapshot(sessionId)
          .pipe(Effect.orElseSucceed((): readonly string[] => []));

        const keywords = Arr.filter(
          Arr.map(task.split(/\s+/), (w) => w.toLowerCase().replace(/[^a-z0-9-]/g, "")),
          (w) => w.length > 2 && !STOP_WORDS.has(w),
        );

        const memories = yield* store
          .query(keywords, { state: "ACTIVE" })
          .pipe(Effect.orElseSucceed((): readonly MemoryNode[] => []));

        const minScaleIdx = scaleOrder.indexOf("finding");
        const filtered = Arr.filter(memories, (m) => scaleOrder.indexOf(m.scale) >= minScaleIdx);

        return {
          sessionId,
          phase: toPhaseInfo(firstPhase),
          question: firstPhase.exit_question,
          totalPhases: machine.phases.length,
          memories: filtered,
        };
      });

      return PhaseEngine.of({
        draft: Effect.fn("PhaseEngine.draft")(function* (task: string) {
          const sessionId = yield* generateSessionId;
          yield* eventLog.createSession(sessionId);
          const ts = yield* now;
          yield* eventLog.appendManifest(sessionId, { type: "task_start", task, ts });
          return sessionId;
        }),

        start: Effect.fn("PhaseEngine.start")(function* (taskOrSessionId: string) {
          if (isUlid(taskOrSessionId)) {
            const sid = SessionId(taskOrSessionId);
            const isDraft = yield* eventLog.isDraft(sid);
            if (!isDraft) {
              const active = yield* eventLog.isActive(sid);
              if (active) {
                return yield* new PhaseEngineError({
                  message: `Session ${sid} is already started. Use 'next' to advance.`,
                });
              }
              return yield* new PhaseEngineError({
                message: `Session ${sid} is not a draft. It may be completed or not found.`,
              });
            }
            const task = (yield* eventLog.lastTaskName(sid)) ?? "";
            return yield* initializeSession(sid, task);
          }

          const task = taskOrSessionId;
          const sessionId = yield* generateSessionId;
          yield* eventLog.createSession(sessionId);
          const ts = yield* now;
          yield* eventLog.appendManifest(sessionId, { type: "task_start", task, ts });
          return yield* initializeSession(sessionId, task);
        }),

        eval: Effect.fn("PhaseEngine.eval")(function* (input: EvalInput) {
          const isDraftSession = yield* eventLog.isDraft(input.sessionId);
          if (isDraftSession) {
            return yield* new PhaseEngineError({
              message: `Session ${input.sessionId} is a draft. Run 'anakmagang start ${input.sessionId}' to begin orchestration.`,
            });
          }

          const currentPhaseId = yield* eventLog.currentPhase(input.sessionId);
          const taskSizeRef = yield* Ref.make(yield* eventLog.taskSize(input.sessionId));
          const currentTask = yield* eventLog.currentTask(input.sessionId);

          if (currentPhaseId === undefined && (yield* Ref.get(taskSizeRef))) {
            const completionPhase = yield* Arr.last(machine.phases).pipe(
              Effect.fromOption,
              Effect.mapError(
                () => new PhaseEngineError({ message: "Machine has no phases configured" }),
              ),
            );
            return Completed({
              sessionId: input.sessionId,
              rule: "already_complete",
              from: toPhaseInfo(completionPhase),
              actions: [],
            });
          }

          const firstPhaseId = yield* Arr.head(machine.phases).pipe(
            Effect.fromOption,
            Effect.map((p) => p.id),
            Effect.mapError(
              () => new PhaseEngineError({ message: "Machine has no phases configured" }),
            ),
          );
          const isSetup =
            (currentPhaseId === undefined || currentPhaseId === firstPhaseId) &&
            !(yield* Ref.get(taskSizeRef));

          if (isSetup) {
            if (!input.size) {
              return yield* new PhaseEngineError({
                message: `Size classification required to complete setup. Pass --size <${sizeOptions || "TRIVIAL|SMALL|MEDIUM|LARGE"}>`,
              });
            }
            const ts = yield* now;
            yield* eventLog.appendManifest(input.sessionId, {
              type: "task_start",
              task: currentTask ?? "",
              size: input.size,
              ts,
            });
            yield* Ref.set(taskSizeRef, input.size);
          }

          const taskSize = yield* Ref.get(taskSizeRef);
          const activePhases = computeActivePhases(taskSize ?? defaultSize ?? "MEDIUM");
          const effectivePhaseId = currentPhaseId ?? firstPhaseId;
          const currentIdx = activePhases.findIndex((p) => p.id === effectivePhaseId);
          if (currentIdx < 0) {
            return yield* new PhaseEngineError({
              message: `Current phase '${effectivePhaseId}' not found in active phases for size ${taskSize}. Session may be corrupted.`,
            });
          }
          const currentPhase = yield* Arr.get(activePhases, currentIdx).pipe(
            Effect.fromOption,
            Effect.mapError(
              () => new PhaseEngineError({ message: `Phase at index ${currentIdx} not found` }),
            ),
          );

          const transitionGuards = Arr.filter(
            machine.guards ?? [],
            (g) => g.event === "PhaseTransition",
          );
          if (transitionGuards.length > 0) {
            const hookInput = {
              tool_name: "anakmagang eval",
              tool_input: {
                reflection: input.reflection,
                phase: currentPhase.id,
                size: taskSize ?? "",
              },
              session_id: input.sessionId,
            };
            const { results } = yield* guardEvaluator.evaluateAll(
              transitionGuards,
              "PhaseTransition",
              undefined,
              hookInput,
              { CLAUDE_PROJECT_DIR: config.root },
            );
            const blockedGuard = Arr.findFirst(results, $isGuard("Block"));
            if (Option.isSome(blockedGuard)) {
              const ts = yield* now;
              yield* eventLog.appendManifest(input.sessionId, {
                type: "session_suspended",
                phase: currentPhase.id,
                guard: "PhaseTransition",
                reason: blockedGuard.value.message,
                ts,
              });
              return Blocked({
                sessionId: input.sessionId,
                guard: "PhaseTransition",
                message: blockedGuard.value.message,
                from: toPhaseInfo(currentPhase),
              });
            }
          }

          const transitions = machine.transitions ?? [];
          const applicableTransitions = Arr.filter(
            transitions,
            (t) => t.from === "*" || t.from === currentPhase.id,
          );
          const matchedTransition = Arr.findFirst(
            applicableTransitions,
            (t) =>
              (t.when === "confidence_low" && input.confidence === "low") ||
              (t.when === "reflection_empty" && input.reflection.trim() === ""),
          );

          if (Option.isSome(matchedTransition) && currentIdx === 0) {
            const errorMsg =
              matchedTransition.value.when === "confidence_low"
                ? "Already at first phase, cannot go back"
                : "Already at first phase, cannot go back. Provide a reflection.";
            return yield* new PhaseEngineError({ message: errorMsg });
          }

          const direction: "forward" | "back" = Option.isSome(matchedTransition)
            ? "back"
            : "forward";
          const rule = Option.match(matchedTransition, {
            onNone: () => "default",
            onSome: (t) => t.when ?? "default",
          });

          const ts = yield* now;
          const fromPhaseInfo = toPhaseInfo(currentPhase);

          if (direction === "forward") {
            yield* Effect.gen(function* () {
              const files = yield* dirtyBits.diff(input.sessionId);
              if (files.length > 0) {
                yield* eventLog.appendManifest(input.sessionId, {
                  type: "dirty_bits",
                  phase: currentPhase.id,
                  files,
                  ts,
                });
                const onAdvanceCommands = currentPhase.on_advance ?? [];
                yield* dirtyBits.runOnAdvance(
                  input.sessionId,
                  currentPhase.id,
                  onAdvanceCommands,
                  files,
                );
              }
              yield* dirtyBits.snapshot(input.sessionId);
            }).pipe(
              Effect.catch((e) =>
                Effect.logWarning("DirtyBits error during phase advance: " + e.message),
              ),
            );
          }

          if (direction === "forward") {
            const rollbackCommands = currentPhase.on_rollback ?? [];
            yield* Effect.forEach(rollbackCommands, (action) =>
              eventLog.appendManifest(input.sessionId, {
                type: "compensation_registered",
                phase: currentPhase.id,
                action,
                scope: "session",
                ts,
              }),
            );
          }

          if (direction === "back") {
            yield* eventLog.appendManifest(input.sessionId, {
              type: "observation",
              text: `LOW_CONFIDENCE(${rule}): ${input.reflection}`,
              ts,
            });

            const prevPhase = yield* Arr.get(activePhases, currentIdx - 1).pipe(
              Effect.fromOption,
              Effect.mapError(
                () =>
                  new PhaseEngineError({
                    message: `Previous phase at index ${currentIdx - 1} not found`,
                  }),
              ),
            );
            yield* eventLog.appendManifest(input.sessionId, {
              type: "phase_advance",
              phase: currentPhase.id,
              reflection: input.reflection,
              next_phase: prevPhase.id,
              ts,
            });

            yield* dirtyBits
              .snapshot(input.sessionId)
              .pipe(Effect.orElseSucceed((): readonly string[] => []));

            return LoopedBack({
              sessionId: input.sessionId,
              rule,
              from: fromPhaseInfo,
              to: toPhaseInfo(prevPhase),
              question: prevPhase.exit_question,
              reason: `LOW_CONFIDENCE(${rule})`,
            });
          }

          const nextIdx = currentIdx + 1;
          if (nextIdx >= activePhases.length) {
            yield* eventLog.appendManifest(input.sessionId, {
              type: "phase_advance",
              phase: currentPhase.id,
              reflection: input.reflection,
              ts,
            });

            return Completed({
              sessionId: input.sessionId,
              rule: "final_phase",
              from: fromPhaseInfo,
              actions: currentPhase.actions ?? [],
            });
          }

          const nextPhase = yield* Arr.get(activePhases, nextIdx).pipe(
            Effect.fromOption,
            Effect.mapError(
              () => new PhaseEngineError({ message: `Next phase at index ${nextIdx} not found` }),
            ),
          );

          yield* eventLog.appendManifest(input.sessionId, {
            type: "phase_advance",
            phase: currentPhase.id,
            reflection: input.reflection,
            next_phase: nextPhase.id,
            ts,
          });

          return Advanced({
            sessionId: input.sessionId,
            rule,
            from: fromPhaseInfo,
            to: toPhaseInfo(nextPhase),
            question: nextPhase.exit_question,
            actions: nextPhase.actions ?? [],
          });
        }),

        observe: Effect.fn("PhaseEngine.observe")(function* (
          text: string,
          sessionId: SessionIdType,
        ) {
          const ts = yield* now;
          yield* eventLog.appendManifest(sessionId, { type: "observation", text, ts });
        }),

        resume: Effect.fn("PhaseEngine.resume")(function* (sessionId: SessionIdType) {
          const entries = yield* eventLog.readRawEvents(sessionId);
          const state = deriveState(sessionId, entries);
          if (state._tag !== "Suspended") {
            return yield* new PhaseEngineError({
              message: `Session ${sessionId} is not suspended (current state: ${state._tag})`,
            });
          }
          const ts = yield* now;
          yield* eventLog.appendManifest(sessionId, {
            type: "session_resumed",
            phase: state.phase,
            ts,
          });
          const phaseConfig = machine.phases.find((p) => p.id === state.phase);
          if (!phaseConfig) {
            return yield* new PhaseEngineError({
              message: `Phase '${state.phase}' not found in machine configuration`,
            });
          }
          const phaseInfo = toPhaseInfo(phaseConfig);
          return Advanced({
            sessionId,
            rule: "session_resumed",
            from: phaseInfo,
            to: phaseInfo,
            question: phaseConfig.exit_question,
          });
        }),

        fail: Effect.fn("PhaseEngine.fail")(function* (sessionId: SessionIdType, reason: string) {
          const entries = yield* eventLog.readRawEvents(sessionId);
          const state = deriveState(sessionId, entries);
          if (state._tag === "Completed" || state._tag === "Failed") {
            return yield* new PhaseEngineError({
              message: `Session ${sessionId} is already ${state._tag.toLowerCase()}`,
            });
          }
          const currentPhaseId = yield* eventLog.currentPhase(sessionId);
          const compensations = Arr.reverse(
            Arr.filter(
              entries,
              (
                e,
              ): e is typeof e & {
                readonly type: "compensation_registered";
                readonly scope: string;
                readonly action: string;
                readonly phase: string;
              } => e.type === "compensation_registered" && e["scope"] === "session",
            ),
          );
          const ts = yield* now;
          const results = yield* Effect.forEach(compensations, (comp) =>
            Effect.gen(function* () {
              const action = comp["action"] ?? "";
              const phase = comp["phase"] ?? "";
              const cmd = ChildProcess.make("sh", ["-c", action], { cwd: config.root });
              const result = yield* spawner.exitCode(cmd).pipe(
                Effect.map((code): "success" | "failed" => (code === 0 ? "success" : "failed")),
                Effect.orElseSucceed((): "success" | "failed" => "failed"),
              );
              yield* eventLog.appendManifest(sessionId, {
                type: "compensation_executed",
                phase,
                action,
                result,
                ts,
              });
              return { phase, action, result };
            }),
          );
          yield* eventLog.appendManifest(sessionId, {
            type: "session_failed",
            phase: currentPhaseId ?? "",
            reason,
            ts,
          });
          return { compensations: results };
        }),
      });
    }),
  );
}
