import { Context, Data, Effect, Layer, Schema } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { isUlid } from "./Ulid"
import { Config } from "./Config"

export class EventLogError extends Data.TaggedError("EventLogError")<{
  readonly sid: string
  readonly message: string
}> {}

export type ManifestEvent =
  | { readonly type: "task_start"; readonly task: string; readonly size?: string; readonly ts: string }
  | { readonly type: "phase_advance"; readonly phase: string; readonly reflection: string; readonly ts: string }
  | { readonly type: "observation"; readonly text: string; readonly ts: string }

export type LogEvent =
  | { readonly type: "iteration"; readonly agent: string; readonly task_hash: string; readonly ts: string }

const serializeManifestEvent = (event: ManifestEvent): string => {
  switch (event.type) {
    case "task_start": {
      const lines = [`- type: task_start`, `  task: ${quoteYaml(event.task)}`]
      if (event.size !== undefined) lines.push(`  size: ${event.size}`)
      lines.push(`  ts: "${event.ts}"`)
      return lines.join("\n")
    }
    case "phase_advance":
      return [
        `- type: phase_advance`,
        `  phase: ${event.phase}`,
        `  reflection: ${quoteYaml(event.reflection)}`,
        `  ts: "${event.ts}"`,
      ].join("\n")
    case "observation":
      return [
        `- type: observation`,
        `  text: ${quoteYaml(event.text)}`,
        `  ts: "${event.ts}"`,
      ].join("\n")
  }
}

const serializeLogEvent = (event: LogEvent): string =>
  [
    `- type: iteration`,
    `  agent: ${event.agent}`,
    `  task_hash: ${event.task_hash}`,
    `  ts: "${event.ts}"`,
  ].join("\n")

const quoteYaml = (value: string): string => {
  if (
    value.includes(":") ||
    value.includes("#") ||
    value.includes("\n") ||
    value.includes('"') ||
    value.includes("'") ||
    value.includes("[") ||
    value.includes("]") ||
    value.includes("{") ||
    value.includes("}") ||
    value.includes(",") ||
    value.includes("*") ||
    value.includes("&") ||
    value.includes("!") ||
    value.includes("|") ||
    value.includes(">") ||
    value.includes("%") ||
    value.includes("@") ||
    value.includes("`") ||
    value === "" ||
    value === "true" ||
    value === "false" ||
    value === "null" ||
    /^\d/.test(value) ||
    /^[-?]/.test(value)
  ) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
  }
  return value
}

export interface ParsedManifestEntry {
  readonly type: string
  readonly [key: string]: string | undefined
}

const findLast = <T>(arr: ReadonlyArray<T>, pred: (item: T) => boolean): T | undefined =>
  Array.from(arr).reverse().find(pred)

const unquoteManifestVal = (raw: string): string => {
  const v = raw.trim()
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    : v
}

const parseManifestEntries = (content: string): ParsedManifestEntry[] => {
  if (content.trim() === "") return []
  const blocks = content.split(/^(?=- type:)/m).filter((b) => b.trim() !== "")
  return blocks.map((block) => {
    const fields: { type: string; [key: string]: string | undefined } = { type: "" }
    const lines = block.split("\n").filter((l) => l.trim() !== "")
    for (const line of lines) {
      const trimmed = line.startsWith("- ") ? line.slice(2).trim() : line.trim()
      const colonIdx = trimmed.indexOf(":")
      if (colonIdx === -1) continue
      const key = trimmed.slice(0, colonIdx).trim()
      const val = unquoteManifestVal(trimmed.slice(colonIdx + 1))
      fields[key] = val
    }
    return fields
  })
}

interface ParsedLogEntry {
  readonly type: string
  readonly agent: string
  readonly task_hash: string
  readonly ts: string
}

const unquoteVal = (raw: string): string => {
  const v = raw.trim()
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1)
    : v
}

const parseLogEntries = (content: string): ParsedLogEntry[] => {
  if (content.trim() === "") return []
  const blocks = content.split(/^(?=- type:)/m).filter((b) => b.trim() !== "")
  return blocks.map((block) => {
    const fields: Record<string, string> = {}
    const lines = block.split("\n").filter((l) => l.trim() !== "")
    for (const line of lines) {
      const trimmed = line.startsWith("- ") ? line.slice(2).trim() : line.trim()
      const colonIdx = trimmed.indexOf(":")
      if (colonIdx === -1) continue
      const key = trimmed.slice(0, colonIdx).trim()
      const val = unquoteVal(trimmed.slice(colonIdx + 1))
      fields[key] = val
    }
    return {
      type: fields["type"] ?? "",
      agent: fields["agent"] ?? "",
      task_hash: fields["task_hash"] ?? "",
      ts: fields["ts"] ?? "",
    }
  })
}

export interface EventLogContract {
  readonly appendManifest: (sid: string, event: ManifestEvent) => Effect.Effect<void, EventLogError>
  readonly appendLog: (sid: string, event: LogEvent) => Effect.Effect<void, EventLogError>
  readonly writeJson: <A>(sid: string, namespace: string, key: string, data: A, schema: Schema.Encoder<A>) => Effect.Effect<void, EventLogError>
  readonly readJson: <A>(sid: string, namespace: string, key: string, schema: Schema.Decoder<A>) => Effect.Effect<A | undefined, EventLogError>
  readonly resolveByKey: (namespace: string, key: string) => Effect.Effect<string | undefined, EventLogError>
  readonly createSession: (sid: string) => Effect.Effect<void, EventLogError>
  readonly currentTask: (sid: string) => Effect.Effect<string | undefined, EventLogError>
  readonly currentPhase: (sid: string) => Effect.Effect<string | undefined, EventLogError>
  readonly taskSize: (sid: string) => Effect.Effect<string | undefined, EventLogError>
  readonly completedPhases: (sid: string) => Effect.Effect<string[], EventLogError>
  readonly reflections: (sid: string) => Effect.Effect<Array<{ phase: string; reflection: string }>, EventLogError>
  readonly observations: (sid: string) => Effect.Effect<string[], EventLogError>
  readonly isActive: (sid: string) => Effect.Effect<boolean, EventLogError>
  readonly iterationCount: (sid: string, agent: string, taskHash: string) => Effect.Effect<number, EventLogError>
  readonly listSessions: () => Effect.Effect<string[], EventLogError>
  readonly removeSession: (sid: string) => Effect.Effect<void, EventLogError>
  readonly readRawEvents: (sid: string) => Effect.Effect<ParsedManifestEntry[], EventLogError>
}

export class EventLog extends Context.Service<EventLog, EventLogContract>()("@anakmagang/EventLog") {
  static readonly layer = Layer.effect(
    EventLog,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const p = yield* Path
      const config = yield* Config

      const outDir = config.outDir

      const manifestPath = (sid: string) => p.join(outDir, sid, "manifest.yaml")
      const logsPath = (sid: string) => p.join(outDir, sid, "logs.yaml")
      const jsonPath = (sid: string, namespace: string, key: string) =>
        p.join(outDir, sid, namespace, `${key}.json`)

      const readFileOrEmpty = Effect.fn("EventLog.readFileOrEmpty")(function* (filePath: string) {
        const exists = yield* fs.exists(filePath).pipe(Effect.orElseSucceed(() => false))
        if (!exists) return ""
        return yield* fs.readFileString(filePath).pipe(Effect.orElseSucceed(() => ""))
      })

      const appendToFile = Effect.fn("EventLog.appendToFile")(function* (
        filePath: string,
        entry: string,
        sid: string,
      ) {
        const dir = p.dirname(filePath)
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError(() => new EventLogError({ sid, message: `Failed to create directory: ${dir}` }))
        )
        const existing = yield* readFileOrEmpty(filePath)
        const newContent = existing.trim() === "" ? entry + "\n" : existing.trimEnd() + "\n" + entry + "\n"
        const tmp = `${filePath}.tmp`
        yield* fs.writeFileString(tmp, newContent).pipe(
          Effect.mapError(() => new EventLogError({ sid, message: `Failed to write temp: ${tmp}` }))
        )
        yield* fs.rename(tmp, filePath).pipe(
          Effect.mapError(() => new EventLogError({ sid, message: `Failed to rename: ${tmp} -> ${filePath}` }))
        )
      })

      const readManifest = Effect.fn("EventLog.readManifest")(function* (sid: string) {
        const content = yield* readFileOrEmpty(manifestPath(sid))
        return parseManifestEntries(content)
      })

      const readLogs = Effect.fn("EventLog.readLogs")(function* (sid: string) {
        const content = yield* readFileOrEmpty(logsPath(sid))
        return parseLogEntries(content)
      })

      return {
        appendManifest: Effect.fn("EventLog.appendManifest")(function* (sid: string, event: ManifestEvent) {
          yield* appendToFile(manifestPath(sid), serializeManifestEvent(event), sid)
        }),

        appendLog: Effect.fn("EventLog.appendLog")(function* (sid: string, event: LogEvent) {
          yield* appendToFile(logsPath(sid), serializeLogEvent(event), sid)
        }),

        writeJson: Effect.fn("EventLog.writeJson")(function* <A>(
          sid: string,
          namespace: string,
          key: string,
          data: A,
          schema: Schema.Encoder<A>,
        ) {
          const dir = p.join(outDir, sid, namespace)
          yield* fs.makeDirectory(dir, { recursive: true }).pipe(
            Effect.mapError(() => new EventLogError({ sid, message: `Failed to create dir: ${dir}` }))
          )
          const target = jsonPath(sid, namespace, key)
          const tmp = `${target}.tmp`
          const json = yield* Effect.try({
            try: () => Schema.encodeSync(Schema.fromJsonString(schema))(data) + "\n",
            catch: (e) => new EventLogError({ sid, message: `Failed to serialize JSON: ${String(e)}` }),
          })
          yield* fs.writeFileString(tmp, json).pipe(
            Effect.mapError(() => new EventLogError({ sid, message: `Failed to write temp: ${tmp}` }))
          )
          yield* fs.rename(tmp, target).pipe(
            Effect.mapError(() => new EventLogError({ sid, message: `Failed to rename: ${tmp} -> ${target}` }))
          )
        }),

        createSession: Effect.fn("EventLog.createSession")(function* (sid: string) {
          const dir = p.join(outDir, sid)
          yield* fs.makeDirectory(dir, { recursive: true }).pipe(
            Effect.mapError(() => new EventLogError({ sid, message: `Failed to create session dir: ${dir}` }))
          )
        }),

        currentTask: Effect.fn("EventLog.currentTask")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          const lastAdvance = findLast(entries, (e) => e.type === "phase_advance")
          if (lastAdvance !== undefined && lastAdvance["phase"] === "completion") return undefined
          const lastStart = findLast(entries, (e) => e.type === "task_start")
          return lastStart?.["task"]
        }),

        currentPhase: Effect.fn("EventLog.currentPhase")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          const lastAdvance = findLast(entries, (e) => e.type === "phase_advance")
          if (lastAdvance === undefined) return undefined
          if (lastAdvance["phase"] === "completion") return undefined
          return lastAdvance["phase"]
        }),

        taskSize: Effect.fn("EventLog.taskSize")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          const lastStart = findLast(entries, (e) => e.type === "task_start")
          return lastStart?.["size"]
        }),

        completedPhases: Effect.fn("EventLog.completedPhases")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          return entries
            .filter((e) => e.type === "phase_advance")
            .map((e) => e["phase"])
            .filter((p): p is string => p !== undefined)
        }),

        reflections: Effect.fn("EventLog.reflections")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          return entries
            .filter((e) => e.type === "phase_advance")
            .map((e) => ({ phase: e["phase"] ?? "", reflection: e["reflection"] ?? "" }))
        }),

        observations: Effect.fn("EventLog.observations")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          return entries
            .filter((e) => e.type === "observation")
            .map((e) => e["text"])
            .filter((t): t is string => t !== undefined)
        }),

        isActive: Effect.fn("EventLog.isActive")(function* (sid: string) {
          const entries = yield* readManifest(sid)
          const hasStart = entries.some((e) => e.type === "task_start")
          if (!hasStart) return false
          const lastAdvance = findLast(entries, (e) => e.type === "phase_advance")
          return lastAdvance === undefined || lastAdvance["phase"] !== "completion"
        }),

        iterationCount: Effect.fn("EventLog.iterationCount")(function* (
          sid: string,
          agent: string,
          taskHash: string,
        ) {
          const entries = yield* readLogs(sid)
          return entries.filter(
            (e) => e.type === "iteration" && e.agent === agent && e.task_hash === taskHash,
          ).length
        }),

        resolveByKey: Effect.fn("EventLog.resolveByKey")(function* (namespace: string, key: string) {
          const dirExists = yield* fs.exists(outDir).pipe(Effect.orElseSucceed(() => false))
          if (!dirExists) return undefined
          const entries = yield* fs.readDirectory(outDir).pipe(Effect.orElseSucceed((): string[] => []))
          for (const entry of entries) {
            if (!entry.startsWith("session-") && !isUlid(entry)) continue
            const target = jsonPath(entry, namespace, key)
            const exists = yield* fs.exists(target).pipe(Effect.orElseSucceed(() => false))
            if (exists) return entry
          }
          return undefined
        }),

        readJson: <A>(sid: string, namespace: string, key: string, schema: Schema.Decoder<A>): Effect.Effect<A | undefined, EventLogError> =>
          Effect.gen(function* () {
            const target = jsonPath(sid, namespace, key)
            const exists = yield* fs.exists(target).pipe(Effect.orElseSucceed(() => false))
            if (!exists) return undefined
            const content = yield* fs.readFileString(target).pipe(
              Effect.mapError(() => new EventLogError({ sid, message: `Failed to read: ${target}` }))
            )
            const decoded = yield* Effect.try({
              try: () => Schema.decodeUnknownSync(Schema.fromJsonString(schema))(content),
              catch: (e) => new EventLogError({ sid, message: `Failed to parse ${target}: ${String(e)}` }),
            })
            return decoded
          }),

        listSessions: Effect.fn("EventLog.listSessions")(function* () {
          const dirExists = yield* fs.exists(outDir).pipe(Effect.orElseSucceed(() => false))
          if (!dirExists) return []
          const entries = yield* fs.readDirectory(outDir).pipe(Effect.orElseSucceed((): string[] => []))
          return entries.filter((e) => e.startsWith("session-") || isUlid(e))
        }),

        removeSession: Effect.fn("EventLog.removeSession")(function* (sid: string) {
          const dir = p.join(outDir, sid)
          yield* fs.remove(dir, { recursive: true }).pipe(
            Effect.mapError(() => new EventLogError({ sid, message: `Failed to remove session dir: ${dir}` }))
          )
        }),

        readRawEvents: Effect.fn("EventLog.readRawEvents")(function* (sid: string) {
          return yield* readManifest(sid)
        }),
      }
    }),
  ).pipe(Layer.provide(Config.layer))
}
