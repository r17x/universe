import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Layer,
  Option,
  Order,
  Result,
  Schema,
} from "effect";
import { glyphRegistry, glyphToSvg } from "./web.image";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { EventLog } from "./EventLog";
import { Config } from "./Config";
import { MachineLoader } from "./MachineLoader";
import { WebRpcs, PhaseEngineRpcError, WebRpcError } from "./web.rpc";
import type {
  GuardInfo,
  TransitionInfo,
  SizePresetInfo,
  StoreInfo,
  GraphNode,
  TranscriptEntry,
} from "./web.rpc";
import { PhaseEngine } from "./PhaseEngine";
import { $match, type EvalInput } from "./protocol.EvalResult";
import type { GuardConfig } from "./protocol.GuardConfig";
import type { Transition, SizePreset, StoreEntry } from "./Machine";
import { MemoryStore } from "./MemoryStore";
import { EventBus } from "./EventBus";
import { ProjectRegistered } from "./DomainEvent";
import { ProjectRegistry } from "./ProjectRegistry";
import { ProjectScope } from "./ProjectScope";
import { extractContent, type ContentBlock } from "./extractContent";
import { PhaseEngineLayers } from "./Layers";

const mapGuards = (guards: ReadonlyArray<GuardConfig> | undefined): ReadonlyArray<GuardInfo> =>
  Arr.map(guards ?? [], (g) => ({
    type: g.type,
    description: g.description ?? "",
    event: g.event ?? "",
    matcher: g.matcher ?? "",
    enforcedBy: g.enforced_by ?? "",
  }));

const mapTransitions = (
  transitions: ReadonlyArray<Transition> | undefined,
): ReadonlyArray<TransitionInfo> =>
  Arr.map(transitions ?? [], (t) => ({
    type: t.when ?? "",
    from: t.from,
    to: t.to,
    when: t.when ?? "",
    description: t.description ?? "",
  }));

const mapSizePresets = (
  presets: Record<string, SizePreset> | undefined,
  allPhases: ReadonlyArray<{ id: string }>,
): ReadonlyArray<SizePresetInfo> => {
  if (!presets) return [];
  return Object.entries(presets).map(([name, preset]) => {
    const activePhases = preset.phases
      ? preset.phases.includes("all")
        ? allPhases.map((p: { id: string }) => p.id)
        : preset.phases
      : preset.skip
        ? allPhases
            .filter((p: { id: string }) => !preset.skip?.includes(p.id))
            .map((p: { id: string }) => p.id)
        : allPhases.map((p: { id: string }) => p.id);
    return {
      name,
      activePhases,
      criteria: preset.criteria ?? [],
    };
  });
};

const mapStores = (stores: ReadonlyArray<StoreEntry>): ReadonlyArray<StoreInfo> =>
  Arr.map(stores, (s) => {
    const detail =
      s.kind === "Slot"
        ? `${s.per}: ${Object.entries(s.tracks)
            .map(([k, v]) => `${k}(${v})`)
            .join(", ")}`
        : s.kind === "Memory"
          ? `${s.path} (budget: ${s.budget})`
          : `${s.path} (${s.writable ? "writable" : "readonly"})`;
    return { kind: s.kind, name: s.name, detail };
  });

export const WebRpcHandlersLayer = WebRpcs.toLayer(
  Effect.gen(function* () {
    const scope = yield* ProjectScope;
    const registry = yield* ProjectRegistry;
    const eventBus = yield* EventBus;

    const active = () => scope.forActiveProject();

    return WebRpcs.of({
      ListSessions: () =>
        Effect.gen(function* () {
          const { eventLog, terminalLabel } = yield* active();
          const sids = yield* eventLog.listSessions();
          return yield* Effect.forEach(
            sids,
            (id) =>
              Effect.gen(function* () {
                const task = yield* eventLog.lastTaskName(id);
                const phase = yield* eventLog.currentPhase(id);
                const size = yield* eventLog.taskSize(id);
                const isActiveSession = yield* eventLog.isActive(id);
                return {
                  id,
                  task: task ?? "",
                  phase: phase ?? (isActiveSession ? "" : terminalLabel),
                  size: size ?? "",
                  isActive: isActiveSession,
                };
              }),
            { concurrency: "unbounded" },
          );
        }).pipe(Effect.mapError((e) => new WebRpcError({ message: String(e) }))),

      GetSession: (req) =>
        Effect.gen(function* () {
          const { eventLog, machine, terminalLabel } = yield* active();
          const id = req.id;
          const task = yield* eventLog.lastTaskName(id);
          const phase = yield* eventLog.currentPhase(id);
          const size = yield* eventLog.taskSize(id);
          const isActiveSession = yield* eventLog.isActive(id);
          const completedPhases = yield* eventLog.completedPhases(id);
          const reflections = yield* eventLog.reflections(id);
          const observations = yield* eventLog.observations(id);
          const guardEvents = yield* eventLog.guardEvents(id);
          const rawEvents = yield* eventLog.readRawEvents(id);
          const providerSessions = yield* eventLog.listProviderSessions(id);

          const computeActivePhaseIds = (sz: string | undefined): ReadonlyArray<string> => {
            const allPhases = machine.phases;
            const allPhaseIds = Arr.map(allPhases, (p) => p.id);
            if (!sz) return allPhaseIds;
            const presets = machine.size_presets;
            if (!presets) return allPhaseIds;
            const preset = presets[sz];
            if (!preset) return allPhaseIds;
            if (preset.phases) {
              if (preset.phases.includes("all")) return allPhaseIds;
              return preset.phases.filter((pid) => allPhases.some((p) => p.id === pid));
            }
            if (preset.skip) {
              const skipSet = new Set(preset.skip);
              return Arr.filter(allPhaseIds, (pid) => !skipSet.has(pid));
            }
            return allPhaseIds;
          };

          const activePhases = computeActivePhaseIds(size ?? undefined);
          const transitions = mapTransitions(machine.transitions);
          const sizePresetCriteria = (() => {
            if (!size) return [] as ReadonlyArray<string>;
            const presets = machine.size_presets;
            if (!presets) return [] as ReadonlyArray<string>;
            const preset = presets[size];
            if (!preset) return [] as ReadonlyArray<string>;
            return preset.criteria ?? ([] as ReadonlyArray<string>);
          })();

          return {
            id,
            task: task ?? "",
            phase: phase ?? (isActiveSession ? "" : terminalLabel),
            size: size ?? "",
            isActive: isActiveSession,
            completedPhases,
            activePhases,
            reflections,
            observations,
            guardEvents: Arr.map(guardEvents, (ge) => ({
              guard: ge.guard,
              decision: ge.decision,
              message: Option.fromUndefinedOr(ge.message),
            })),
            events: Arr.map(rawEvents, (e) => {
              const { type, ...rest } = e;
              const fields = Object.fromEntries(
                Object.entries(rest)
                  .filter(([, v]) => v !== undefined)
                  .map(([k, v]) => [k, v ?? ""]),
              ) as Record<string, string>;
              return { type, fields };
            }),
            providerSessions,
            transitions,
            sizePresetCriteria,
          };
        }).pipe(Effect.mapError((e) => new WebRpcError({ message: String(e) }))),

      GetDashboard: () =>
        Effect.gen(function* () {
          const { eventLog, machine } = yield* active();
          const sids = yield* eventLog.listSessions();
          const sessionData = yield* Effect.forEach(
            sids,
            (id) =>
              Effect.gen(function* () {
                const isActiveSession = yield* eventLog.isActive(id);
                const completed = yield* eventLog.completedPhases(id);
                const size = yield* eventLog.taskSize(id);
                return {
                  active: isActiveSession,
                  completedCount: completed.length,
                  size: size ?? "",
                };
              }),
            { concurrency: "unbounded" },
          );

          const totalSessions = sessionData.length;
          const activeSessions = Arr.filter(sessionData, (s) => s.active).length;
          const totalPhases = Arr.reduce(sessionData, 0, (acc, s) => acc + s.completedCount);
          const completionRate =
            totalSessions === 0 ? 0 : (totalSessions - activeSessions) / totalSessions;

          const sizeKeys = Object.keys(machine.size_presets ?? {});
          const sizeCounts = Object.fromEntries(
            sizeKeys.map((k) => [k, Arr.filter(sessionData, (s) => s.size === k).length]),
          );

          const guardCount = (machine.guards ?? []).length;

          const sessionDates = yield* Effect.forEach(
            sids,
            (id) =>
              Effect.gen(function* () {
                const events = yield* eventLog.readRawEvents(id);
                const startEvent = events.find((e) => e.type === "task_start");
                return startEvent?.["ts"] ? startEvent["ts"].slice(0, 10) : undefined;
              }),
            { concurrency: "unbounded" },
          );

          const dateCounts = Arr.reduce(
            Arr.filter(sessionDates, (d): d is string => d !== undefined),
            {} as Record<string, number>,
            (acc, d) => ({ ...acc, [d]: (acc[d] ?? 0) + 1 }),
          );

          const nowMs = yield* Clock.currentTimeMillis;
          const heatmapEntries = Arr.makeBy(365, (idx) => {
            const i = 364 - idx;
            const d = new Date(nowMs);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const count = dateCounts[dateStr] ?? 0;
            const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
            return { date: dateStr, count, level };
          });

          return {
            activeSessions,
            totalSessions,
            totalPhases,
            completionRate,
            guardCount,
            sizeCounts,
            heatmap: heatmapEntries,
          };
        }).pipe(Effect.mapError((e) => new WebRpcError({ message: String(e) }))),

      Healthcheck: () => Effect.void,

      Shutdown: () =>
        Effect.sleep("100 millis").pipe(
          Effect.andThen(Effect.sync(() => process.exit(0))),
          Effect.forkDetach,
          Effect.andThen(Effect.void),
        ),

      GetPhases: () =>
        Effect.gen(function* () {
          const { machine } = yield* active();
          return Arr.map(machine.phases, (p) => ({
            id: p.id,
            name: p.name,
            exitQuestion: p.exit_question,
            skipWhen: p.skip_when ?? [],
            actions: p.actions ?? [],
          }));
        }),

      GetConfig: () =>
        Effect.gen(function* () {
          const { machine } = yield* active();
          return {
            name: machine.name,
            version: machine.version,
            guards: mapGuards(machine.guards),
            transitions: mapTransitions(machine.transitions),
            sizePresets: mapSizePresets(machine.size_presets, machine.phases),
            stores: mapStores(machine.ground.stores),
          };
        }),

      GetGlyphs: () => Effect.succeed(Arr.map(glyphRegistry, glyphToSvg)),

      ListProjects: () =>
        Effect.gen(function* () {
          const activeId = yield* registry.activeProjectId();
          const projects = yield* registry.list();
          return Arr.map(projects, (p) => ({
            id: p.id,
            name: p.name,
            root: p.root,
            isActive: p.id === activeId,
          }));
        }),

      SetActiveProject: (req) => registry.setActive(req.id).pipe(Effect.asVoid),

      RegisterProject: (req) =>
        Effect.gen(function* () {
          const activeId = yield* registry.activeProjectId();
          const entry = yield* registry.register(req.root);
          yield* eventBus.publish(
            ProjectRegistered({
              projectId: entry.id,
              projectName: entry.name,
              timestamp: DateTime.formatIso(DateTime.makeUnsafe(yield* Clock.currentTimeMillis)),
            }),
          );
          return {
            id: entry.id,
            name: entry.name,
            root: entry.root,
            isActive: entry.id === activeId,
          };
        }),

      GetGraph: () =>
        Effect.gen(function* () {
          const { eventLog, machine } = yield* active();

          const sids = yield* eventLog.listSessions();
          const sessionNodes = yield* Effect.forEach(
            sids,
            (id) =>
              Effect.gen(function* () {
                const task = yield* eventLog.lastTaskName(id);
                const isActiveSession = yield* eventLog.isActive(id);
                const completedPhases = yield* eventLog.completedPhases(id);
                return {
                  node: {
                    id: `s:${id}`,
                    label: task ?? id.slice(0, 8),
                    kind: "session" as const,
                    active: isActiveSession,
                    weight: Math.max(1, completedPhases.length / 4),
                  },
                  completedPhases,
                  sessionId: id,
                };
              }),
            { concurrency: "unbounded" },
          );

          const memoryStore = yield* Effect.serviceOption(MemoryStore);
          const memoryNodes = yield* Option.match(memoryStore, {
            onNone: () =>
              Effect.succeed(
                [] as ReadonlyArray<{ node: GraphNode; derivedFrom: ReadonlyArray<string> }>,
              ),
            onSome: (store) =>
              Effect.gen(function* () {
                const nodes = yield* store.list();
                return Arr.map(nodes, (n) => ({
                  node: {
                    id: `m:${n.id}`,
                    label: n.name,
                    kind: "memory" as const,
                    active: n.state === "ACTIVE",
                    weight: n.scale === "principle" ? 3 : n.scale === "learning" ? 2 : 1,
                  },
                  derivedFrom: n.edges.derived_from,
                }));
              }),
          });

          const guardNodes = Arr.map(machine.guards ?? [], (g) => ({
            id: `g:${g.type}`,
            label: g.type,
            kind: "guard" as const,
            active: true,
            weight: 1,
          }));

          const storeNodes = Arr.map(machine.ground.stores, (s) => ({
            id: `st:${s.name}`,
            label: s.name,
            kind: "store" as const,
            active: true,
            weight: 1,
          }));

          const transitionNodes = Arr.map(machine.transitions ?? [], (t, i) => ({
            id: `t:${i}`,
            label: `${t.from} → ${t.to}`,
            kind: "transition" as const,
            active: true,
            weight: 0.5,
          }));

          const sizePresetNodes = Arr.map(
            Object.keys(machine.size_presets ?? {}),
            (name: string) => ({
              id: `sz:${name}`,
              label: name,
              kind: "size_preset" as const,
              active: true,
              weight: 1.5,
            }),
          );

          const nodes = [
            ...Arr.map(sessionNodes, (s) => s.node),
            ...Arr.map(memoryNodes, (m) => m.node),
            ...guardNodes,
            ...storeNodes,
            ...transitionNodes,
            ...sizePresetNodes,
          ];

          const memoryDerivedEdges = Arr.flatMap(memoryNodes, (m) =>
            Arr.map(m.derivedFrom, (parentId) => ({
              source: m.node.id,
              target: `m:${parentId}`,
              kind: "memory_derived" as const,
            })),
          );

          const sessionMemoryEdges = Arr.flatMap(sessionNodes, (s) =>
            Arr.filterMap(memoryNodes, (m) =>
              s.node.active && m.node.active
                ? Result.succeed({
                    source: s.node.id,
                    target: m.node.id,
                    kind: "session_memory" as const,
                  })
                : Result.fail(undefined),
            ),
          );

          const edges = [...memoryDerivedEdges, ...sessionMemoryEdges];

          return { nodes, edges };
        }).pipe(Effect.mapError((e) => new WebRpcError({ message: String(e) }))),

      GetTranscript: (req) =>
        Effect.gen(function* () {
          const { eventLog, outDir } = yield* active();
          const fs = yield* FileSystem;
          const path = yield* Path;
          const providerSessions = yield* eventLog.listProviderSessions(req.sessionId);

          const BridgeEntry = Schema.Struct({
            transcript_path: Schema.optional(Schema.String),
            last_seen: Schema.optional(Schema.String),
          });
          const TranscriptLine = Schema.Struct({
            type: Schema.String,
            timestamp: Schema.optional(Schema.String),
            message: Schema.optional(
              Schema.Struct({
                role: Schema.optional(Schema.String),
                content: Schema.optional(Schema.Unknown),
              }),
            ),
          });

          const entries = yield* Effect.forEach(
            Arr.flatMap(providerSessions, (ps) => Arr.map(ps.sessionIds, (psId) => ({ ps, psId }))),
            ({ ps, psId }) =>
              Effect.gen(function* () {
                const bridgePath = path.join(outDir, req.sessionId, ps.provider, psId + ".json");
                const bridgeExists = yield* fs
                  .exists(bridgePath)
                  .pipe(Effect.orElseSucceed(() => false));
                if (!bridgeExists) return Arr.empty<TranscriptEntry>();

                const bridgeContent = yield* fs
                  .readFileString(bridgePath)
                  .pipe(Effect.orElseSucceed(() => "[]"));
                const bridgeArray = yield* Schema.decodeUnknownEffect(
                  Schema.fromJsonString(Schema.Array(BridgeEntry)),
                )(bridgeContent).pipe(
                  Effect.orElseSucceed((): ReadonlyArray<typeof BridgeEntry.Type> => []),
                );
                if (bridgeArray.length === 0) return Arr.empty<TranscriptEntry>();

                const startTime = bridgeArray[0]?.last_seen ?? "";
                const endTime = bridgeArray[bridgeArray.length - 1]?.last_seen ?? "";

                const lastEntry = bridgeArray[bridgeArray.length - 1];
                if (!lastEntry?.transcript_path) return Arr.empty<TranscriptEntry>();

                const transcriptExists = yield* fs
                  .exists(lastEntry.transcript_path)
                  .pipe(Effect.orElseSucceed(() => false));
                if (!transcriptExists) return Arr.empty<TranscriptEntry>();

                const transcriptContent = yield* fs
                  .readFileString(lastEntry.transcript_path)
                  .pipe(Effect.orElseSucceed(() => ""));
                const transcriptLines = transcriptContent
                  .split("\n")
                  .filter((l) => l.trim().length > 0);

                const parsed = yield* Effect.forEach(transcriptLines, (line) =>
                  Schema.decodeUnknownEffect(Schema.fromJsonString(TranscriptLine))(line).pipe(
                    Effect.orElseSucceed((): typeof TranscriptLine.Type | null => null),
                  ),
                );

                return Arr.flatMap(parsed, (p): ReadonlyArray<TranscriptEntry> => {
                  if (p === null) return [];
                  const timestamp = p.timestamp ?? "";
                  if (timestamp < startTime || timestamp > endTime) return [];
                  if ((p.type !== "user" && p.type !== "assistant") || !p.message) return [];
                  const content = p.message.content
                    ? extractContent(p.message.content as string | ReadonlyArray<ContentBlock>)
                    : "";
                  if (content.length === 0) return [];
                  return [
                    {
                      role: p.type,
                      content,
                      timestamp: p.timestamp ?? "",
                      provider: ps.provider,
                      providerSessionId: psId,
                    },
                  ];
                });
              }),
          );

          const flat: ReadonlyArray<TranscriptEntry> = Arr.flatten(entries);
          return Arr.sort(
            flat,
            Order.mapInput(Order.String, (e: TranscriptEntry) => e.timestamp),
          );
        }).pipe(Effect.mapError((e) => new WebRpcError({ message: String(e) }))),

      StartSession: (req) =>
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const result = yield* engine.start(req.task);
          return {
            sessionId: result.sessionId,
            phase: { id: result.phase.id, name: result.phase.name, number: result.phase.number },
            question: result.question,
            totalPhases: result.totalPhases,
          };
        }).pipe(Effect.mapError((e) => new PhaseEngineRpcError({ message: String(e) }))),

      EvalSession: (req) =>
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const input = {
            reflection: req.reflection,
            sessionId: req.sessionId,
            ...(req.size !== undefined ? { size: req.size } : {}),
            ...(req.confidence !== undefined ? { confidence: req.confidence } : {}),
          } satisfies EvalInput;
          const result = yield* engine.eval(input);
          return $match(result, {
            Advanced: (r) => ({
              _tag: "Advanced" as const,
              sessionId: r.sessionId,
              rule: r.rule,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
              to: { id: r.to.id, name: r.to.name, number: r.to.number },
              question: r.question,
              actions: r.actions as ReadonlyArray<string> | undefined,
            }),
            LoopedBack: (r) => ({
              _tag: "LoopedBack" as const,
              sessionId: r.sessionId,
              rule: r.rule,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
              to: { id: r.to.id, name: r.to.name, number: r.to.number },
              question: r.question,
              reason: r.reason,
            }),
            Completed: (r) => ({
              _tag: "Completed" as const,
              sessionId: r.sessionId,
              rule: r.rule,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
              actions: r.actions as ReadonlyArray<string>,
            }),
            Blocked: (r) => ({
              _tag: "Blocked" as const,
              sessionId: r.sessionId,
              guard: r.guard,
              message: r.message,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
            }),
          });
        }).pipe(Effect.mapError((e) => new PhaseEngineRpcError({ message: e.message }))),

      ResumeSession: (req) =>
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const result = yield* engine.resume(req.sessionId);
          return $match(result, {
            Advanced: (r) => ({
              _tag: "Advanced" as const,
              sessionId: r.sessionId,
              rule: r.rule,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
              to: { id: r.to.id, name: r.to.name, number: r.to.number },
              question: r.question,
              actions: r.actions as ReadonlyArray<string> | undefined,
            }),
            LoopedBack: (r) => ({
              _tag: "LoopedBack" as const,
              sessionId: r.sessionId,
              rule: r.rule,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
              to: { id: r.to.id, name: r.to.name, number: r.to.number },
              question: r.question,
              reason: r.reason,
            }),
            Completed: (r) => ({
              _tag: "Completed" as const,
              sessionId: r.sessionId,
              rule: r.rule,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
              actions: r.actions as ReadonlyArray<string>,
            }),
            Blocked: (r) => ({
              _tag: "Blocked" as const,
              sessionId: r.sessionId,
              guard: r.guard,
              message: r.message,
              from: { id: r.from.id, name: r.from.name, number: r.from.number },
            }),
          });
        }).pipe(Effect.mapError((e) => new PhaseEngineRpcError({ message: e.message }))),

      FailSession: (req) =>
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const result = yield* engine.fail(req.sessionId, req.reason);
          return {
            compensations: Arr.map(result.compensations, (c) => ({
              phase: c.phase,
              action: c.action,
              result: c.result,
            })),
          };
        }).pipe(Effect.mapError((e) => new PhaseEngineRpcError({ message: e.message }))),
    });
  }),
);

export const WebRpcLayer = WebRpcHandlersLayer.pipe(
  Layer.provide(
    ProjectScope.layer.pipe(
      Layer.provideMerge(PhaseEngineLayers),
      Layer.provideMerge(
        Layer.mergeAll(
          EventLog.layer,
          MachineLoader.layer,
          ProjectRegistry.layer,
          EventBus.layer,
          Config.layer,
          MemoryStore.layer,
        ),
      ),
    ),
  ),
);
