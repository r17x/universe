// Append-only event log for session manifests, iteration logs, and JSON state.

import {
  Array as Arr,
  Clock,
  Context,
  DateTime,
  Effect,
  Layer,
  Order,
  Result,
  Schema,
  pipe,
} from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { isUlid, SessionId } from "./Ulid";
import type { SessionId as SessionIdType } from "./Ulid";
import { Config } from "./Config";
import { quoteYaml } from "./Yaml";

export class EventLogError extends Schema.TaggedErrorClass<EventLogError>()("EventLogError", {
  sid: Schema.String,
  message: Schema.String,
}) {}

export type ManifestEvent =
  | {
      readonly type: "task_start";
      readonly task: string;
      readonly size?: string;
      readonly ts: string;
    }
  | { readonly type: "session_init"; readonly phase: string; readonly ts: string }
  | {
      readonly type: "phase_advance";
      readonly phase: string;
      readonly reflection: string;
      readonly ts: string;
      readonly next_phase?: string;
    }
  | { readonly type: "observation"; readonly text: string; readonly ts: string }
  | {
      readonly type: "dirty_bits";
      readonly phase: string;
      readonly files: ReadonlyArray<string>;
      readonly ts: string;
    }
  | {
      readonly type: "guard_fired";
      readonly guard: string;
      readonly decision: string;
      readonly message?: string;
      readonly ts: string;
    }
  | {
      readonly type: "artifact_add";
      readonly path: string;
      readonly source: string;
      readonly tags: ReadonlyArray<string>;
      readonly size: number;
      readonly ts: string;
    }
  | {
      readonly type: "session_suspended";
      readonly phase: string;
      readonly guard: string;
      readonly reason: string;
      readonly ts: string;
    }
  | { readonly type: "session_resumed"; readonly phase: string; readonly ts: string }
  | {
      readonly type: "compensation_registered";
      readonly phase: string;
      readonly action: string;
      readonly scope: "phase" | "session";
      readonly ts: string;
    }
  | {
      readonly type: "compensation_executed";
      readonly phase: string;
      readonly action: string;
      readonly result: "success" | "failed";
      readonly ts: string;
    }
  | {
      readonly type: "session_failed";
      readonly phase: string;
      readonly reason: string;
      readonly ts: string;
    };

export type LogEvent = {
  readonly type: "iteration";
  readonly agent: string;
  readonly task_hash: string;
  readonly ts: string;
};

const serializeManifestEvent = (event: ManifestEvent) => {
  switch (event.type) {
    case "task_start":
      return [
        `- type: task_start`,
        `  task: ${quoteYaml(event.task)}`,
        ...(event.size !== undefined ? [`  size: ${event.size}`] : []),
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "session_init":
      return [`- type: session_init`, `  phase: ${event.phase}`, `  ts: "${event.ts}"`].join("\n");
    case "phase_advance":
      return [
        `- type: phase_advance`,
        `  phase: ${event.phase}`,
        `  reflection: ${quoteYaml(event.reflection)}`,
        ...(event.next_phase ? [`  next_phase: ${event.next_phase}`] : []),
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "observation":
      return [
        `- type: observation`,
        `  text: ${quoteYaml(event.text)}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "dirty_bits":
      return [
        `- type: dirty_bits`,
        `  phase: ${event.phase}`,
        `  files: ${quoteYaml(event.files.join(","))}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "guard_fired":
      return [
        `- type: guard_fired`,
        `  guard: ${event.guard}`,
        `  decision: ${event.decision}`,
        ...(event.message !== undefined ? [`  message: ${quoteYaml(event.message)}`] : []),
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "artifact_add":
      return [
        `- type: artifact_add`,
        `  path: ${quoteYaml(event.path)}`,
        `  source: ${quoteYaml(event.source)}`,
        `  tags: ${quoteYaml(event.tags.join(","))}`,
        `  size: ${event.size}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "session_suspended":
      return [
        `- type: session_suspended`,
        `  phase: ${event.phase}`,
        `  guard: ${quoteYaml(event.guard)}`,
        `  reason: ${quoteYaml(event.reason)}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "session_resumed":
      return [`- type: session_resumed`, `  phase: ${event.phase}`, `  ts: "${event.ts}"`].join(
        "\n",
      );
    case "compensation_registered":
      return [
        `- type: compensation_registered`,
        `  phase: ${event.phase}`,
        `  action: ${quoteYaml(event.action)}`,
        `  scope: ${event.scope}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "compensation_executed":
      return [
        `- type: compensation_executed`,
        `  phase: ${event.phase}`,
        `  action: ${quoteYaml(event.action)}`,
        `  result: ${event.result}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "session_failed":
      return [
        `- type: session_failed`,
        `  phase: ${quoteYaml(event.phase)}`,
        `  reason: ${quoteYaml(event.reason)}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
  }
};

const serializeLogEvent = (event: LogEvent) =>
  [
    `- type: iteration`,
    `  agent: ${event.agent}`,
    `  task_hash: ${event.task_hash}`,
    `  ts: "${event.ts}"`,
  ].join("\n");

export interface ParsedManifestEntry {
  readonly type: string;
  readonly [key: string]: string | undefined;
}

const unquoteManifestVal = (raw: string) => {
  const v = raw.trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    : v;
};

const parseManifestEntries = (content: string) => {
  if (content.trim() === "") return [];
  const blocks = pipe(
    content.split(/^(?=- type:)/m),
    Arr.filter((b) => b.trim() !== ""),
  );
  return pipe(
    Arr.map(blocks, (block) => {
      const lines = pipe(
        block.split("\n"),
        Arr.filter((l) => l.trim() !== ""),
      );
      const fields: ParsedManifestEntry = {
        type: "",
        ...Object.fromEntries(
          Arr.filterMap(lines, (line) => {
            const trimmed = line.startsWith("- ") ? line.slice(2).trim() : line.trim();
            const colonIdx = trimmed.indexOf(":");
            return colonIdx === -1
              ? Result.failVoid
              : Result.succeed([
                  trimmed.slice(0, colonIdx).trim(),
                  unquoteManifestVal(trimmed.slice(colonIdx + 1)),
                ] as const);
          }),
        ),
      };
      return fields;
    }),
    Arr.filter((entry) => entry.type !== ""),
  );
};

interface ParsedLogEntry {
  readonly type: string;
  readonly agent: string;
  readonly task_hash: string;
  readonly ts: string;
}

const unquoteVal = (raw: string) => {
  const v = raw.trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1)
    : v;
};

const parseLogEntries = (content: string): ParsedLogEntry[] => {
  if (content.trim() === "") return [];
  const blocks = pipe(
    content.split(/^(?=- type:)/m),
    Arr.filter((b) => b.trim() !== ""),
  );
  return Arr.map(blocks, (block) => {
    const lines = pipe(
      block.split("\n"),
      Arr.filter((l) => l.trim() !== ""),
    );
    const fields: Record<string, string> = Object.fromEntries(
      Arr.filterMap(lines, (line) => {
        const trimmed = line.startsWith("- ") ? line.slice(2).trim() : line.trim();
        const colonIdx = trimmed.indexOf(":");
        return colonIdx === -1
          ? Result.failVoid
          : Result.succeed([
              trimmed.slice(0, colonIdx).trim(),
              unquoteVal(trimmed.slice(colonIdx + 1)),
            ] as const);
      }),
    );
    return {
      type: fields["type"] ?? "",
      agent: fields["agent"] ?? "",
      task_hash: fields["task_hash"] ?? "",
      ts: fields["ts"] ?? "",
    };
  });
};

export interface EventLogContract {
  readonly appendManifest: (
    sid: SessionIdType,
    event: ManifestEvent,
  ) => Effect.Effect<void, EventLogError>;
  readonly appendLog: (sid: SessionIdType, event: LogEvent) => Effect.Effect<void, EventLogError>;
  readonly writeJson: <A>(
    sid: SessionIdType,
    namespace: string,
    key: string,
    data: A,
    schema: Schema.Encoder<A>,
  ) => Effect.Effect<void, EventLogError>;
  readonly readJson: <A>(
    sid: SessionIdType,
    namespace: string,
    key: string,
    schema: Schema.Decoder<A>,
  ) => Effect.Effect<A | undefined, EventLogError>;
  readonly listKeys: (
    sid: SessionIdType,
    namespace: string,
  ) => Effect.Effect<string[], EventLogError>;
  readonly removeJson: (
    sid: SessionIdType,
    namespace: string,
    key: string,
  ) => Effect.Effect<void, EventLogError>;
  readonly resolveByKey: (
    namespace: string,
    key: string,
  ) => Effect.Effect<string | undefined, EventLogError>;
  readonly createSession: (sid: SessionIdType) => Effect.Effect<void, EventLogError>;
  readonly currentTask: (sid: SessionIdType) => Effect.Effect<string | undefined, EventLogError>;
  readonly lastTaskName: (sid: SessionIdType) => Effect.Effect<string | undefined, EventLogError>;
  readonly currentPhase: (sid: SessionIdType) => Effect.Effect<string | undefined, EventLogError>;
  readonly taskSize: (sid: SessionIdType) => Effect.Effect<string | undefined, EventLogError>;
  readonly completedPhases: (sid: SessionIdType) => Effect.Effect<string[], EventLogError>;
  readonly reflections: (
    sid: SessionIdType,
  ) => Effect.Effect<Array<{ phase: string; reflection: string }>, EventLogError>;
  readonly observations: (sid: SessionIdType) => Effect.Effect<string[], EventLogError>;
  readonly guardEvents: (
    sid: SessionIdType,
  ) => Effect.Effect<
    Array<{ guard: string; decision: string; message: string | undefined }>,
    EventLogError
  >;
  readonly isActive: (sid: SessionIdType) => Effect.Effect<boolean, EventLogError>;
  readonly isDraft: (sid: SessionIdType) => Effect.Effect<boolean, EventLogError>;
  readonly iterationCount: (
    sid: SessionIdType,
    agent: string,
    taskHash: string,
  ) => Effect.Effect<number, EventLogError>;
  readonly listSessions: () => Effect.Effect<SessionIdType[], EventLogError>;
  readonly removeSession: (sid: SessionIdType) => Effect.Effect<void, EventLogError>;
  readonly readRawEvents: (
    sid: SessionIdType,
  ) => Effect.Effect<ParsedManifestEntry[], EventLogError>;
  readonly findActiveSession: () => Effect.Effect<SessionIdType | undefined, EventLogError>;
  readonly addArtifact: (
    sid: SessionIdType,
    event: { path: string; source: string; tags: ReadonlyArray<string>; size: number },
  ) => Effect.Effect<void, EventLogError>;
  readonly listArtifacts: (
    sid: SessionIdType,
  ) => Effect.Effect<
    ReadonlyArray<{ path: string; source: string; tags: ReadonlyArray<string>; size: number }>,
    EventLogError
  >;
  readonly syncArtifacts: (
    sid: SessionIdType,
  ) => Effect.Effect<ReadonlyArray<{ path: string; size: number }>, EventLogError>;
  readonly listProviderSessions: (
    sid: SessionIdType,
  ) => Effect.Effect<
    ReadonlyArray<{ provider: string; sessionIds: ReadonlyArray<string> }>,
    EventLogError
  >;
}

export class EventLog extends Context.Service<EventLog, EventLogContract>()(
  "@anakmagang/EventLog",
) {
  static readonly bare = Layer.effect(
    EventLog,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const p = yield* Path;
      const config = yield* Config;

      const outDir = config.outDir;
      const terminalPhase = config.terminalPhase;

      const manifestPath = (sid: string) => p.join(outDir, sid, "manifest.yaml");
      const logsPath = (sid: string) => p.join(outDir, sid, "logs.yaml");
      const jsonPath = (sid: string, namespace: string, key: string) =>
        p.join(outDir, sid, namespace, `${key}.json`);

      const readFileOrEmpty = Effect.fn("EventLog.readFileOrEmpty")(function* (filePath: string) {
        const exists = yield* fs.exists(filePath).pipe(Effect.orElseSucceed(() => false));
        if (!exists) return "";
        return yield* fs.readFileString(filePath).pipe(Effect.orElseSucceed(() => ""));
      });

      const appendToFile = Effect.fn("EventLog.appendToFile")(function* (
        filePath: string,
        entry: string,
        sid: string,
      ) {
        const dir = p.dirname(filePath);
        yield* fs
          .makeDirectory(dir, { recursive: true })
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to create directory: ${dir}` }),
            ),
          );
        const existing = yield* readFileOrEmpty(filePath);
        const newContent =
          existing.trim() === "" ? entry + "\n" : existing.trimEnd() + "\n" + entry + "\n";
        const tmp = `${filePath}.tmp`;
        yield* fs
          .writeFileString(tmp, newContent)
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to write temp: ${tmp}` }),
            ),
          );
        yield* fs
          .rename(tmp, filePath)
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to rename: ${tmp} -> ${filePath}` }),
            ),
          );
      });

      const readManifest = Effect.fn("EventLog.readManifest")(function* (sid: string) {
        const content = yield* readFileOrEmpty(manifestPath(sid));
        return parseManifestEntries(content);
      });

      const readLogs = Effect.fn("EventLog.readLogs")(function* (sid: string) {
        const content = yield* readFileOrEmpty(logsPath(sid));
        return parseLogEntries(content);
      });

      const appendManifest = Effect.fn("EventLog.appendManifest")(function* (
        sid: SessionIdType,
        event: ManifestEvent,
      ) {
        yield* appendToFile(manifestPath(sid), serializeManifestEvent(event), sid);
      });

      const appendLog = Effect.fn("EventLog.appendLog")(function* (
        sid: SessionIdType,
        event: LogEvent,
      ) {
        yield* appendToFile(logsPath(sid), serializeLogEvent(event), sid);
      });

      const writeJson = Effect.fn("EventLog.writeJson")(function* <A>(
        sid: SessionIdType,
        namespace: string,
        key: string,
        data: A,
        schema: Schema.Encoder<A>,
      ) {
        const dir = p.join(outDir, sid, namespace);
        yield* fs
          .makeDirectory(dir, { recursive: true })
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to create dir: ${dir}` }),
            ),
          );
        const target = jsonPath(sid, namespace, key);
        const tmp = `${target}.tmp`;
        const json = yield* Effect.try({
          try: () => Schema.encodeSync(Schema.fromJsonString(schema))(data) + "\n",
          catch: (e) =>
            new EventLogError({ sid, message: `Failed to serialize JSON: ${String(e)}` }),
        });
        yield* fs
          .writeFileString(tmp, json)
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to write temp: ${tmp}` }),
            ),
          );
        yield* fs
          .rename(tmp, target)
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to rename: ${tmp} -> ${target}` }),
            ),
          );
      });

      const createSession = Effect.fn("EventLog.createSession")(function* (sid: SessionIdType) {
        const dir = p.join(outDir, sid);
        yield* fs
          .makeDirectory(dir, { recursive: true })
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to create session dir: ${dir}` }),
            ),
          );
      });

      const isSessionComplete = (entries: ReadonlyArray<ParsedManifestEntry>) => {
        const terminalCompletion = entries.some(
          (e) => e.type === "phase_advance" && e["phase"] === terminalPhase && !e["next_phase"],
        );
        if (terminalCompletion) return true;
        const completionCount = Arr.filter(
          entries,
          (e) => e.type === "phase_advance" && e["phase"] === terminalPhase,
        ).length;
        return completionCount >= 2;
      };

      const currentTask = Effect.fn("EventLog.currentTask")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        if (isSessionComplete(entries)) return undefined;
        const lastStart = entries.findLast((e) => e.type === "task_start");
        return lastStart?.["task"];
      });

      const lastTaskName = Effect.fn("EventLog.lastTaskName")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        const lastStart = entries.findLast((e) => e.type === "task_start");
        return lastStart?.["task"];
      });

      const currentPhase = Effect.fn("EventLog.currentPhase")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        const lastAdvance = entries.findLast((e) => e.type === "phase_advance");
        if (lastAdvance === undefined) {
          const init = entries.findLast((e) => e.type === "session_init");
          return init?.["phase"];
        }
        if (isSessionComplete(entries)) return undefined;
        return lastAdvance["next_phase"] ?? lastAdvance["phase"];
      });

      const taskSize = Effect.fn("EventLog.taskSize")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        const lastStart = entries.findLast((e) => e.type === "task_start");
        return lastStart?.["size"];
      });

      const completedPhases = Effect.fn("EventLog.completedPhases")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        return pipe(
          entries,
          Arr.filter((e) => e.type === "phase_advance"),
          Arr.map((e) => e["phase"]),
          Arr.filter((p): p is string => p !== undefined),
        );
      });

      const reflections = Effect.fn("EventLog.reflections")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        return pipe(
          entries,
          Arr.filter(
            (e) =>
              e.type === "phase_advance" && e["reflection"] !== undefined && e["reflection"] !== "",
          ),
          Arr.map((e) => ({ phase: e["phase"] ?? "", reflection: e["reflection"] ?? "" })),
        );
      });

      const observations = Effect.fn("EventLog.observations")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        return pipe(
          entries,
          Arr.filter((e) => e.type === "observation"),
          Arr.map((e) => e["text"]),
          Arr.filter((t): t is string => t !== undefined),
        );
      });

      const guardEvents = Effect.fn("EventLog.guardEvents")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        return pipe(
          entries,
          Arr.filter((e) => e.type === "guard_fired"),
          Arr.map((e) => ({
            guard: e["guard"] ?? "",
            decision: e["decision"] ?? "",
            message: e["message"],
          })),
        );
      });

      const isActive = Effect.fn("EventLog.isActive")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        const hasInit = entries.some((e) => e.type === "session_init");
        if (!hasInit) return false;
        return !isSessionComplete(entries);
      });

      const findActiveSession = Effect.fn("EventLog.findActiveSession")(function* () {
        const dirExists = yield* fs.exists(outDir).pipe(Effect.orElseSucceed(() => false));
        if (!dirExists) return undefined;
        const entries = yield* fs
          .readDirectory(outDir)
          .pipe(Effect.orElseSucceed((): string[] => []));
        const validEntries = pipe(
          entries,
          Arr.filter((e) => e.startsWith("session-") || isUlid(e)),
          Arr.map((e) => SessionId(e)),
        );
        const activeSids = yield* Effect.filter(validEntries, (sid) =>
          readManifest(sid).pipe(
            Effect.map((manifest) => {
              const hasInit = manifest.some((e) => e.type === "session_init");
              if (!hasInit) return false;
              return !isSessionComplete(manifest);
            }),
            Effect.orElseSucceed(() => false),
          ),
        );
        return activeSids.length === 1 ? activeSids[0] : undefined;
      });

      const isDraft = Effect.fn("EventLog.isDraft")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        const hasStart = entries.some((e) => e.type === "task_start");
        const hasInit = entries.some((e) => e.type === "session_init");
        return hasStart && !hasInit;
      });

      const iterationCount = Effect.fn("EventLog.iterationCount")(function* (
        sid: SessionIdType,
        agent: string,
        taskHash: string,
      ) {
        const entries = yield* readLogs(sid);
        return Arr.filter(
          entries,
          (e) => e.type === "iteration" && e.agent === agent && e.task_hash === taskHash,
        ).length;
      });

      const resolveByKey = Effect.fn("EventLog.resolveByKey")(function* (
        namespace: string,
        key: string,
      ) {
        const dirExists = yield* fs.exists(outDir).pipe(Effect.orElseSucceed(() => false));
        if (!dirExists) return undefined;
        const entries = yield* fs
          .readDirectory(outDir)
          .pipe(Effect.orElseSucceed((): string[] => []));
        const validEntries = Arr.filter(entries, (e) => e.startsWith("session-") || isUlid(e));
        const found = yield* Effect.forEach(validEntries, (entry) =>
          fs.exists(jsonPath(entry, namespace, key)).pipe(
            Effect.orElseSucceed(() => false),
            Effect.map((exists): string | undefined => (exists ? entry : undefined)),
          ),
        );
        return found.find((e) => e !== undefined);
      });

      const readJson = <A>(
        sid: SessionIdType,
        namespace: string,
        key: string,
        schema: Schema.Decoder<A>,
      ): Effect.Effect<A | undefined, EventLogError> =>
        Effect.gen(function* () {
          const target = jsonPath(sid, namespace, key);
          const exists = yield* fs.exists(target).pipe(Effect.orElseSucceed(() => false));
          if (!exists) return undefined;
          const content = yield* fs
            .readFileString(target)
            .pipe(
              Effect.mapError(
                () => new EventLogError({ sid, message: `Failed to read: ${target}` }),
              ),
            );
          const decoded = yield* Effect.try({
            try: () => Schema.decodeUnknownSync(Schema.fromJsonString(schema))(content),
            catch: (e) =>
              new EventLogError({ sid, message: `Failed to parse ${target}: ${String(e)}` }),
          });
          return decoded;
        });

      const listKeys = Effect.fn("EventLog.listKeys")(function* (
        sid: SessionIdType,
        namespace: string,
      ) {
        const dir = p.join(outDir, sid, namespace);
        const exists = yield* fs.exists(dir).pipe(Effect.orElseSucceed(() => false));
        if (!exists) return [];
        const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed((): string[] => []));
        const result = pipe(
          entries,
          Arr.filter((e) => e.endsWith(".json")),
          Arr.map((e) => e.replace(/\.json$/, "")),
        );
        return result;
      });

      const removeJson = Effect.fn("EventLog.removeJson")(function* (
        sid: SessionIdType,
        namespace: string,
        key: string,
      ) {
        const target = jsonPath(sid, namespace, key);
        yield* fs.remove(target).pipe(Effect.ignore);
      });

      const listSessions = Effect.fn("EventLog.listSessions")(function* () {
        const dirExists = yield* fs.exists(outDir).pipe(Effect.orElseSucceed(() => false));
        if (!dirExists) return [];
        const entries = yield* fs
          .readDirectory(outDir)
          .pipe(Effect.orElseSucceed((): string[] => []));
        return Arr.sort(
          pipe(
            entries,
            Arr.filter((e) => e.startsWith("session-") || isUlid(e)),
            Arr.map((e) => SessionId(e)),
          ),
          Order.flip(Order.String),
        );
      });

      const removeSession = Effect.fn("EventLog.removeSession")(function* (sid: SessionIdType) {
        const dir = p.join(outDir, sid);
        yield* fs
          .remove(dir, { recursive: true })
          .pipe(
            Effect.mapError(
              () => new EventLogError({ sid, message: `Failed to remove session dir: ${dir}` }),
            ),
          );
      });

      const readRawEvents = Effect.fn("EventLog.readRawEvents")(function* (sid: SessionIdType) {
        return yield* readManifest(sid);
      });

      const addArtifact = Effect.fn("EventLog.addArtifact")(function* (
        sid: SessionIdType,
        event: { path: string; source: string; tags: ReadonlyArray<string>; size: number },
      ) {
        const ts = DateTime.formatIso(DateTime.makeUnsafe(yield* Clock.currentTimeMillis));
        yield* appendManifest(sid, {
          type: "artifact_add",
          path: event.path,
          source: event.source,
          tags: event.tags,
          size: event.size,
          ts,
        });
      });

      const listArtifacts = Effect.fn("EventLog.listArtifacts")(function* (sid: SessionIdType) {
        const entries = yield* readManifest(sid);
        return pipe(
          entries,
          Arr.filter((e) => e.type === "artifact_add"),
          Arr.map((e) => ({
            path: e["path"] ?? "",
            source: e["source"] ?? "",
            tags: (e["tags"] ?? "").split(",").filter(Boolean),
            size: Number(e["size"] ?? "0"),
          })),
        );
      });

      const INFRA_PREFIXES = ["manifest.yaml", "logs.yaml", "dirty/", "claude/"];
      const isInfraPath = (relPath: string) =>
        INFRA_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(prefix));

      const scanDir = (
        dir: string,
        baseDir: string,
      ): Effect.Effect<ReadonlyArray<string>, EventLogError> =>
        Effect.gen(function* () {
          const entries = yield* fs
            .readDirectory(dir)
            .pipe(
              Effect.mapError(
                () => new EventLogError({ sid: "", message: `Failed to read directory: ${dir}` }),
              ),
            );
          const nested = yield* Effect.forEach(entries, (entry) =>
            Effect.gen(function* () {
              const fullPath = p.join(dir, entry);
              const stat = yield* fs
                .stat(fullPath)
                .pipe(
                  Effect.mapError(
                    () => new EventLogError({ sid: "", message: `Failed to stat: ${fullPath}` }),
                  ),
                );
              if (stat.type === "Directory") {
                return yield* scanDir(fullPath, baseDir);
              }
              return [fullPath.slice(baseDir.length + 1)];
            }),
          );
          return Arr.flatten(nested);
        });

      const syncArtifacts = Effect.fn("EventLog.syncArtifacts")(function* (sid: SessionIdType) {
        const sessionDir = p.join(outDir, sid);
        const dirExists = yield* fs.exists(sessionDir).pipe(Effect.orElseSucceed(() => false));
        if (!dirExists) return [];

        const allFiles = yield* scanDir(sessionDir, sessionDir);
        const diskFiles = Arr.filter(allFiles, (relPath) => !isInfraPath(relPath));

        const tracked = yield* listArtifacts(sid);
        const trackedPaths = new Set(Arr.map(tracked, (a) => a.path));

        const untracked = Arr.filter(diskFiles, (relPath) => !trackedPaths.has(relPath));

        const synced = yield* Effect.forEach(untracked, (relPath) =>
          Effect.gen(function* () {
            const fullPath = p.join(sessionDir, relPath);
            const stat = yield* fs
              .stat(fullPath)
              .pipe(
                Effect.mapError(
                  () => new EventLogError({ sid, message: `Failed to stat: ${fullPath}` }),
                ),
              );
            const size = Number(stat.size);
            const ts = DateTime.formatIso(DateTime.makeUnsafe(yield* Clock.currentTimeMillis));
            yield* appendManifest(sid, {
              type: "artifact_add",
              path: relPath,
              source: "sync",
              tags: [],
              size,
              ts,
            });
            return { path: relPath, size };
          }),
        );

        return synced;
      });

      const listProviderSessions = Effect.fn("EventLog.listProviderSessions")(function* (
        sid: SessionIdType,
      ) {
        const sessionDir = p.join(outDir, sid);
        const dirExists = yield* fs.exists(sessionDir).pipe(Effect.orElseSucceed(() => false));
        if (!dirExists) return [];

        const entries = yield* fs
          .readDirectory(sessionDir)
          .pipe(
            Effect.mapError(
              () =>
                new EventLogError({ sid, message: `Failed to read session dir: ${sessionDir}` }),
            ),
          );

        const providerDirs = yield* Effect.filter(entries, (entry) =>
          Effect.gen(function* () {
            if (entry === "dirty") return false;
            const fullPath = p.join(sessionDir, entry);
            const stat = yield* fs.stat(fullPath).pipe(Effect.orElseSucceed(() => undefined));
            return stat !== undefined && stat.type === "Directory";
          }),
        );

        const results = yield* Effect.forEach(providerDirs, (dir) =>
          Effect.gen(function* () {
            const dirPath = p.join(sessionDir, dir);
            const files = yield* fs
              .readDirectory(dirPath)
              .pipe(Effect.orElseSucceed((): string[] => []));
            const jsonFiles = Arr.filter(files, (f) => f.endsWith(".json"));
            const sessionIds = Arr.map(jsonFiles, (f) => f.slice(0, -5));
            return { provider: dir, sessionIds };
          }),
        );

        return Arr.filter(results, (r) => r.sessionIds.length > 0);
      });

      return EventLog.of({
        appendManifest,
        appendLog,
        writeJson,
        readJson,
        listKeys,
        removeJson,
        resolveByKey,
        createSession,
        currentTask,
        lastTaskName,
        currentPhase,
        taskSize,
        completedPhases,
        reflections,
        observations,
        guardEvents,
        isActive,
        isDraft,
        iterationCount,
        listSessions,
        removeSession,
        readRawEvents,
        findActiveSession,
        addArtifact,
        listArtifacts,
        syncArtifacts,
        listProviderSessions,
      });
    }),
  );

  static readonly layer = EventLog.bare.pipe(Layer.provide(Config.layer));
}
