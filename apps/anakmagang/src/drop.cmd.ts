import { Argument, Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Clock, Effect, Layer, Option, Schema } from "effect";
import { SessionId } from "./Ulid";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { MachineLoader } from "./MachineLoader";
import { Config } from "./Config";
import { EventLog } from "./EventLog";
import { notifyEvent } from "./notify";
import { SessionCompleted } from "./DomainEvent";
import { Output } from "./protocol.Output";
import { Line, Diagnostic } from "./protocol.Emission";
import * as Markdown from "./Markdown";

const FALLBACK_REFERENCES_DIR = ".anakmagang/out/references";

const DropLayers = Layer.mergeAll(MachineLoader.layer, Config.layer, EventLog.layer);

const dropSession = (sid: SessionId) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const output = yield* Output;
    yield* eventLog.removeSession(sid);
    const ts = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString());
    yield* notifyEvent(SessionCompleted({ sessionId: sid, timestamp: ts }));
    yield* output.emit(Line({ text: `dropped session: ${sid}` }));
  });

const promoteFeedback = (sid: SessionId, root: string, targetDir: string) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const fs = yield* FileSystem;
    const pathSvc = yield* Path;
    const output = yield* Output;

    const reflections = yield* eventLog.reflections(sid);
    const observations = yield* eventLog.observations(sid);

    if (reflections.length === 0 && observations.length === 0) {
      yield* output.emit(Line({ text: `no feedback entries for ${sid}` }));
      return;
    }

    const resolvedDir = pathSvc.resolve(root, targetDir);
    yield* fs
      .makeDirectory(resolvedDir, { recursive: true })
      .pipe(Effect.orElseSucceed(() => void 0));

    const nodes = [
      Markdown.heading(1, `Drop feedback: ${sid}`),
      ...(reflections.length > 0
        ? [
            Markdown.heading(2, "Reflections"),
            Markdown.list(reflections.map((r) => `[${r.phase}] ${r.reflection}`)),
          ]
        : []),
      ...(observations.length > 0
        ? [Markdown.heading(2, "Observations"), Markdown.list(observations)]
        : []),
    ];
    const content = Markdown.prettyPrintMdDoc(Markdown.mdDoc(...nodes));

    const targetPath = pathSvc.join(resolvedDir, `drop-${sid}.md`);
    const tmpPath = `${targetPath}.tmp`;
    yield* fs.writeFileString(tmpPath, content + "\n").pipe(Effect.orElseSucceed(() => void 0));
    yield* fs.rename(tmpPath, targetPath).pipe(Effect.orElseSucceed(() => void 0));
    yield* output.emit(Line({ text: `promoted feedback to ${targetPath}` }));
  });

export const dropCommand = Command.make(
  "drop",
  {
    sessionId: Argument.string("session-id").pipe(
      Argument.withSchema(Schema.NonEmptyString),
      Argument.optional,
    ),
    stale: Flag.boolean("stale").pipe(Flag.withDefault(false)),
    promote: Flag.boolean("promote").pipe(Flag.withDefault(false)),
    to: Flag.string("to").pipe(Flag.withDefault("ephemeral")),
    client: Flag.string("client").pipe(Flag.optional),
  },
  ({ sessionId, stale, promote, to, client: _client }) =>
    Effect.gen(function* () {
      const config = yield* Config;
      const loader = yield* MachineLoader;
      const eventLog = yield* EventLog;
      const output = yield* Output;

      const machine = yield* loader.loadFromFile(config.configPath);

      const memoryStores = Arr.filter(machine.ground.stores, (s) => s.kind === "Memory");
      const validNames = Arr.map(memoryStores, (d) => d.name);

      if (!promote && to !== "ephemeral") {
        yield* output.emit(Diagnostic({ severity: "error", message: "--to requires --promote" }));
        return;
      }

      if (promote && !validNames.includes(to)) {
        yield* output.emit(
          Diagnostic({
            severity: "error",
            message: `invalid --to value "${to}". Valid: ${Arr.join(validNames, ", ")}`,
          }),
        );
        return;
      }

      const targetMemoryDir = Arr.findFirst(memoryStores, (d) => d.name === to).pipe(
        Option.map((d) => d.path),
        Option.getOrElse(() => FALLBACK_REFERENCES_DIR),
      );

      const processSid = (sid: SessionId) =>
        Effect.gen(function* () {
          if (promote) {
            yield* promoteFeedback(sid, config.root, targetMemoryDir);
          }

          yield* dropSession(sid);
        });

      if (stale) {
        const sessions = yield* eventLog.listSessions();
        if (sessions.length === 0) {
          yield* output.emit(Line({ text: "No sessions found." }));
          return;
        }
        const staleSessions = yield* Effect.filter(sessions, (sid) =>
          eventLog.isActive(sid).pipe(Effect.map((active) => !active)),
        );
        yield* Effect.forEach(staleSessions, (sid) => processSid(sid));
        if (staleSessions.length === 0) {
          yield* output.emit(Line({ text: "No stale sessions found." }));
        }
        return;
      }

      if (Option.isNone(sessionId)) {
        yield* output.emit(
          Diagnostic({ severity: "error", message: "session-id required (or use --stale)" }),
        );
        return;
      }

      yield* processSid(SessionId(sessionId.value));
    }).pipe(Effect.provide(DropLayers)),
);
