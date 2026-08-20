import { Flag, Command } from "effect/unstable/cli";
import { Array as A, Clock, DateTime, Effect, Option, Schema, Stream } from "effect";
import { SessionId } from "./Ulid";
import { FileSystem } from "effect/FileSystem";
import { Stdio } from "effect/Stdio";
import { Config } from "./Config";
import { HookLayers } from "./hook";
import { loadGuards } from "./Layers";
import { GuardEvaluator, HookInputSchema, $is, type HookInput } from "./guard";
import { Output } from "./protocol.Output";
import { Diagnostic, Line } from "./protocol.Emission";
import { EventLog } from "./EventLog";
import { MachineLoader } from "./MachineLoader";
import { renderStatusline, type SessionSnapshot } from "./StatuslineRenderer";
import { Bridge } from "./Bridge";
const _env = process.env;

const readStdin = Effect.gen(function* () {
  if (process.stdin.isTTY) return "";
  const stdio = yield* Stdio;
  return yield* stdio.stdin.pipe(Stream.decodeText(), Stream.mkString);
}).pipe(Effect.orElseSucceed(() => ""));

export const hookEvalCommand = Command.make(
  "eval",
  {
    event: Flag.string("event").pipe(Flag.withAlias("e")),
    name: Flag.string("name").pipe(Flag.withAlias("n"), Flag.optional),
    client: Flag.string("client").pipe(Flag.withAlias("c"), Flag.optional),
  },
  ({ event, name, client }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const config = yield* Config;
      const guardEvaluator = yield* GuardEvaluator;
      const guards = yield* loadGuards;
      const bridge = yield* Bridge;

      const clientValue = Option.getOrElse(client, () => config.client);

      const stdinText = yield* readStdin;
      const input =
        stdinText.trim().length > 0
          ? yield* Schema.decodeUnknownEffect(Schema.fromJsonString(HookInputSchema))(
              stdinText,
            ).pipe(Effect.orElseSucceed((): HookInput => ({})))
          : {};

      const agentName = yield* Effect.sync(() => _env["CLAUDE_AGENT_NAME"]);
      const env = {
        CLAUDE_PROJECT_DIR: (yield* Effect.sync(() => _env["CLAUDE_PROJECT_DIR"])) ?? config.root,
        ...(agentName ? { CLAUDE_AGENT_NAME: agentName } : {}),
      };

      if (input.session_id) {
        if (event === "UserPromptSubmit") {
          const resolved = yield* bridge
            .resolve(clientValue, input.session_id)
            .pipe(Effect.orElseSucceed(() => Option.none<string>()));
          if (Option.isSome(resolved)) {
            const sid = SessionId(resolved.value);
            const now = yield* Clock.currentTimeMillis;
            yield* bridge
              .upsert(sid, clientValue, input.session_id, {
                context_window: input.context_window,
                transcript_path: input.transcript_path,
                last_seen: DateTime.formatIso(DateTime.makeUnsafe(now)),
              })
              .pipe(Effect.orElseSucceed(() => void 0));
          }
        } else if (event === "PreToolUse") {
          const command = input.tool_input?.["command"];
          if (typeof command === "string" && command.includes("anakmagang")) {
            const explicitMatch = command.match(/--session\s+(\S+)/);
            const explicitSid = explicitMatch?.[1];
            if (explicitSid) {
              const isMutatingEval =
                /\banakmagang\s+eval\b/.test(command) &&
                !command.includes("--list") &&
                !command.includes("--observe") &&
                !command.includes("--add");
              if (isMutatingEval) {
                const eventLog = yield* EventLog;
                const brandedSid = SessionId(explicitSid);
                const active = yield* eventLog
                  .isActive(brandedSid)
                  .pipe(Effect.orElseSucceed(() => false));
                if (active) {
                  const now = yield* Clock.currentTimeMillis;
                  yield* bridge
                    .upsert(brandedSid, clientValue, input.session_id, {
                      context_window: input.context_window,
                      transcript_path: input.transcript_path,
                      last_seen: DateTime.formatIso(DateTime.makeUnsafe(now)),
                    })
                    .pipe(Effect.orElseSucceed(() => void 0));
                }
              }
            }
          }
        }
      }

      const nameValue = Option.match(name, { onNone: () => undefined, onSome: (v) => v });
      const { results, guards: sortedGuards } = yield* guardEvaluator.evaluateAll(
        guards,
        event,
        nameValue,
        input,
        env,
      );

      const sessionForLogging = yield* Effect.gen(function* () {
        if (input.session_id) {
          const resolved = yield* bridge
            .resolve(clientValue, input.session_id)
            .pipe(Effect.orElseSucceed(() => Option.none<string>()));
          if (Option.isSome(resolved)) return SessionId(resolved.value);
        }
        const eventLog = yield* EventLog;
        return yield* eventLog.findActiveSession().pipe(Effect.orElseSucceed(() => undefined));
      }).pipe(Effect.orElseSucceed(() => undefined));

      if (sessionForLogging !== undefined) {
        const eventLog = yield* EventLog;
        const now = yield* Clock.currentTimeMillis;
        const ts = DateTime.formatIso(DateTime.makeUnsafe(now));
        yield* Effect.forEach(A.zip(sortedGuards, results), ([guard, result]) => {
          if ($is("Allow")(result) || $is("Info")(result)) return Effect.void;
          return eventLog
            .appendManifest(sessionForLogging, {
              type: "guard_fired",
              guard: guard.type,
              decision: $is("Block")(result) ? "block" : "warn",
              message: result.message,
              ts,
            })
            .pipe(Effect.orElseSucceed(() => void 0));
        });
      }

      const block = A.findFirst(results, $is("Block"));
      if (Option.isSome(block)) {
        yield* output.emit(Diagnostic({ severity: "error", message: block.value.message }));
        return yield* Effect.sync(() => process.exit(2));
      }
      const warns = A.filter(results, $is("Warn"));
      yield* Effect.forEach(warns, (w) =>
        output.emit(
          event === "UserPromptSubmit"
            ? Line({ text: w.message })
            : Diagnostic({ severity: "warn", message: w.message }),
        ),
      );
      const infos = A.filter(results, $is("Info"));
      yield* Effect.forEach(infos, (i) =>
        output.emit(Diagnostic({ severity: "info", message: i.message })),
      );

      if (event === "statusLine") {
        const loader = yield* MachineLoader;
        const machine = yield* loader
          .loadFromFile(config.configPath)
          .pipe(Effect.orElseSucceed(() => undefined));

        const sessionState = yield* Effect.gen(function* () {
          if (!input.session_id) return yield* Effect.fail("no-session" as const);

          const resolved = yield* bridge.resolve(clientValue, input.session_id);
          if (Option.isNone(resolved)) return yield* Effect.fail("no-session" as const);

          const sid = SessionId(resolved.value);
          const eventLog = yield* EventLog;
          const currentTask = yield* eventLog.currentTask(sid);
          const currentPhase = yield* eventLog.currentPhase(sid);
          const now = yield* Clock.currentTimeMillis;
          yield* bridge
            .upsert(sid, clientValue, input.session_id, {
              context_window: input.context_window,
              transcript_path: input.transcript_path,
              last_seen: DateTime.formatIso(DateTime.makeUnsafe(now)),
              current_task: currentTask,
              current_phase: currentPhase,
            })
            .pipe(Effect.orElseSucceed(() => void 0));

          return {
            sessionId: sid,
            task: currentTask,
            phase: currentPhase,
          } satisfies SessionSnapshot;
        }).pipe(Effect.option);

        const fs = yield* FileSystem;
        const projectSocket = yield* fs
          .exists(config.socketPath)
          .pipe(Effect.orElseSucceed(() => false));
        const userSocket = yield* fs
          .exists(config.webSocketPath)
          .pipe(Effect.orElseSucceed(() => false));
        const webRunning = projectSocket || userSocket;
        const lines = renderStatusline(
          machine?.ground?.statusline,
          input,
          sessionState,
          webRunning,
        );
        yield* Effect.forEach(lines, (line) => output.emit(Line({ text: line })));
      }
    }).pipe(Effect.provide(HookLayers)),
);
