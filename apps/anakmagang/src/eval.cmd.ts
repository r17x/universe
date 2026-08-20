import { Argument, Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Clock, Effect, Option, Schema } from "effect";
import { SessionId } from "./Ulid";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { PhaseEngine } from "./PhaseEngine";
import { PhaseEngineLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Record, Line } from "./protocol.Emission";
import { EventLog } from "./EventLog";
import { Config } from "./Config";
import { serializeFrontmatter, scalar, list as yamlList } from "./Yaml";
import { notifyEvent } from "./notify";
import { PhaseAdvanced, Observed } from "./DomainEvent";
import { $match as $matchEvalResult } from "./protocol.EvalResult";

class EvalInputError extends Schema.TaggedErrorClass<EvalInputError>()("EvalInputError", {
  message: Schema.String,
}) {}

const FILLER = new Set([
  "done",
  "ok",
  "okay",
  "moving on",
  "next",
  "n/a",
  "na",
  "yes",
  "no",
  "continue",
  "pass",
  "skip",
  "acknowledged",
]);

const Reflection = Schema.NonEmptyString.check(
  Schema.isTrimmed(),
  Schema.isMinLength(10, {
    expected:
      "a reflection of at least 10 characters — provide a substantive answer to the phase exit question",
  }),
  Schema.makeFilter((s: string) =>
    FILLER.has(s.toLowerCase())
      ? `Generic filler "${s}" is not a valid reflection. Answer the phase exit question substantively.`
      : undefined,
  ),
);

const now = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString());

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "svg",
  "pdf",
  "zip",
  "tar",
  "gz",
  "bz2",
  "wasm",
  "dylib",
  "so",
  "dll",
  "mp3",
  "mp4",
  "wav",
  "ogg",
]);

const isBinary = (filePath: string, pathSvc: { extname: (p: string) => string }) => {
  const ext = pathSvc.extname(filePath).slice(1).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
};

const handleAddFile = (sourcePath: string, session: SessionId, tag: Option.Option<string>) =>
  Effect.gen(function* () {
    const fsSvc = yield* FileSystem;
    const pathSvc = yield* Path;
    const eventLog = yield* EventLog;
    const config = yield* Config;
    const output = yield* Output;

    const resolvedSource = pathSvc.isAbsolute(sourcePath)
      ? sourcePath
      : pathSvc.resolve(config.root, sourcePath);
    const basename = pathSvc.basename(resolvedSource);
    const artifactsDir = pathSvc.join(config.outDir, session, "artifacts");
    const tags = Option.match(tag, {
      onNone: (): ReadonlyArray<string> => [],
      onSome: (t) => t.split(",").filter(Boolean),
    });

    yield* fsSvc
      .makeDirectory(artifactsDir, { recursive: true })
      .pipe(Effect.orElseSucceed(() => void 0));

    if (isBinary(resolvedSource, pathSvc)) {
      const targetBinary = pathSvc.join(artifactsDir, basename);
      yield* fsSvc.copyFile(resolvedSource, targetBinary);
      const stat = yield* fsSvc.stat(targetBinary);
      const size = Number(stat.size);

      const sidecarName = `${basename}.md`;
      const sidecarPath = pathSvc.join(artifactsDir, sidecarName);
      const ts = yield* now;
      const fmEntries = [
        { key: "source", value: scalar(resolvedSource) },
        { key: "session", value: scalar(session) },
        { key: "media", value: scalar(basename) },
        { key: "tags", value: yamlList(Arr.map(tags, scalar)) },
        { key: "ts", value: scalar(ts) },
      ];
      const sidecarContent = serializeFrontmatter(fmEntries, "");
      const tmp = `${sidecarPath}.tmp`;
      yield* fsSvc.writeFileString(tmp, sidecarContent);
      yield* fsSvc.rename(tmp, sidecarPath);

      const artifactRelPath = `artifacts/${basename}`;
      yield* eventLog.addArtifact(session, {
        path: artifactRelPath,
        source: resolvedSource,
        tags,
        size,
      });
      yield* output.emit(
        Record({
          fields: [
            ["action", "added"],
            ["path", artifactRelPath],
            ["type", "binary"],
            ["size", String(size)],
          ],
        }),
      );
    } else {
      const targetPath = pathSvc.join(artifactsDir, basename);
      yield* fsSvc.copyFile(resolvedSource, targetPath);
      const stat = yield* fsSvc.stat(targetPath);
      const size = Number(stat.size);

      const artifactRelPath = `artifacts/${basename}`;
      yield* eventLog.addArtifact(session, {
        path: artifactRelPath,
        source: resolvedSource,
        tags,
        size,
      });
      yield* output.emit(
        Record({
          fields: [
            ["action", "added"],
            ["path", artifactRelPath],
            ["type", "text"],
            ["size", String(size)],
          ],
        }),
      );
    }
  });

const handleList = (session: SessionId) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const output = yield* Output;
    const artifacts = yield* eventLog.listArtifacts(session);

    if (Arr.length(artifacts) === 0) {
      yield* output.emit(Line({ text: "No artifacts found." }));
      return;
    }

    yield* Effect.forEach(artifacts, (a) =>
      output.emit(
        Record({
          fields: [
            ["path", a.path],
            ["source", a.source],
            ["tags", a.tags.join(",")],
            ["size", String(a.size)],
          ],
        }),
      ),
    );
  });

export const evalCommand = Command.make(
  "eval",
  {
    text: Argument.string("text").pipe(Argument.optional),
    session: Flag.string("session"),
    size: Flag.string("size").pipe(Flag.withAlias("s"), Flag.optional),
    confidence: Flag.string("confidence").pipe(Flag.withAlias("c"), Flag.optional),
    client: Flag.string("client").pipe(Flag.optional),
    observe: Flag.boolean("observe").pipe(Flag.withDefault(false)),
    add: Flag.string("add").pipe(Flag.optional),
    tag: Flag.string("tag").pipe(Flag.withAlias("t"), Flag.optional),
    list: Flag.boolean("list").pipe(Flag.withDefault(false)),
  },
  ({ text, session: rawSession, size, confidence, client: _client, observe, add, tag, list }) =>
    Effect.gen(function* () {
      const session = SessionId(rawSession);
      const addPath = Option.getOrUndefined(add);
      const modeCount = (observe ? 1 : 0) + (addPath ? 1 : 0) + (list ? 1 : 0);

      if (modeCount > 1) {
        return yield* new EvalInputError({
          message: "Conflicting flags: use only one of --observe, --add, or --list",
        });
      }

      if (list) {
        yield* handleList(session);
        return;
      }

      if (addPath) {
        yield* handleAddFile(addPath, session, tag);
        return;
      }

      const textValue = Option.getOrUndefined(text);
      if (!textValue || textValue.trim() === "") {
        return yield* new EvalInputError({
          message: "A text argument is required for eval and --observe modes",
        });
      }

      if (observe) {
        const engine = yield* PhaseEngine;
        const output = yield* Output;
        yield* engine.observe(textValue, session);
        yield* notifyEvent(
          Observed({ sessionId: session, text: textValue, timestamp: yield* now }),
        );
        yield* output.emit(Line({ text: "observed" }));
        return;
      }

      const reflection = yield* Schema.decodeUnknownEffect(Reflection)(textValue);
      const engine = yield* PhaseEngine;
      const output = yield* Output;
      const evalInput = {
        reflection,
        sessionId: session,
        ...Option.match(size, { onNone: () => ({}), onSome: (s) => ({ size: s }) }),
        ...confidence.pipe(
          Option.filter((v): v is "low" => v === "low"),
          Option.map((confidence) => ({ confidence })),
          Option.getOrElse(() => ({})),
        ),
      };
      const result = yield* engine.eval(evalInput);
      const ts = yield* now;

      yield* $matchEvalResult(result, {
        Advanced: (r) =>
          Effect.gen(function* () {
            yield* notifyEvent(
              PhaseAdvanced({
                sessionId: r.sessionId,
                from: `${r.from.number}/${r.from.id}`,
                to: `${r.to.number}/${r.to.id}`,
                reflection: evalInput.reflection,
                timestamp: ts,
              }),
            );
            const fields: Array<readonly [string, string]> = [
              ["session", r.sessionId],
              ["transition", "forward"],
              ["rule", r.rule],
              ["from", `${r.from.number}/${r.from.id}`],
              ["to", `${r.to.number}/${r.to.id}`],
              ["phase", r.to.id],
              ["question", r.question],
            ];
            yield* output.emit(Record({ fields }));
          }),
        LoopedBack: (r) =>
          Effect.gen(function* () {
            yield* notifyEvent(
              PhaseAdvanced({
                sessionId: r.sessionId,
                from: `${r.from.number}/${r.from.id}`,
                to: `${r.to.number}/${r.to.id}`,
                reflection: evalInput.reflection,
                timestamp: ts,
              }),
            );
            const fields: Array<readonly [string, string]> = [
              ["session", r.sessionId],
              ["transition", "back"],
              ["rule", r.rule],
              ["from", `${r.from.number}/${r.from.id}`],
              ["to", `${r.to.number}/${r.to.id}`],
              ["phase", r.to.id],
              ["question", r.question],
            ];
            yield* output.emit(Record({ fields }));
          }),
        Completed: (r) =>
          Effect.gen(function* () {
            const fields: Array<readonly [string, string]> = [
              ["session", r.sessionId],
              ["transition", "complete"],
              ["rule", r.rule],
              ["from", `${r.from.number}/${r.from.id}`],
            ];
            yield* output.emit(Record({ fields }));
          }),
        Blocked: (r) =>
          Effect.gen(function* () {
            const fields: Array<readonly [string, string]> = [
              ["session", r.sessionId],
              ["transition", "blocked"],
              ["rule", "guard_block"],
              ["from", `${r.from.number}/${r.from.id}`],
              ["guard", r.guard],
              ["message", r.message],
            ];
            yield* output.emit(Record({ fields }));
          }),
      });
    }).pipe(Effect.provide(PhaseEngineLayers)),
);
