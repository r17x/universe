import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Layer, Option, Ref } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { EventLog, type EventLogContract } from "./EventLog"

const DropLayers = Layer.mergeAll(MachineLoader.layer, Config.layer, EventLog.layer)

const dropSession = (eventLog: EventLogContract, sid: string) =>
  Effect.gen(function* () {
    yield* eventLog.removeSession(sid)
    yield* Console.log(`dropped session: ${sid}`)
  })

const promoteFeedback = (
  eventLog: EventLogContract,
  sid: string,
  fs: FileSystem,
  pathSvc: Path,
  root: string,
  targetDir: string,
) =>
  Effect.gen(function* () {
    const reflections = yield* eventLog.reflections(sid)
    const observations = yield* eventLog.observations(sid)

    if (reflections.length === 0 && observations.length === 0) {
      yield* Console.log(`no feedback entries for ${sid}`)
      return
    }

    const resolvedDir = pathSvc.resolve(root, targetDir)
    yield* fs.makeDirectory(resolvedDir, { recursive: true }).pipe(Effect.orElseSucceed(() => void 0))

    const lines: Array<string> = [`# Drop feedback: ${sid}`, ""]
    if (reflections.length > 0) {
      lines.push("## Reflections", "")
      for (const r of reflections) lines.push(`- [${r.phase}] ${r.reflection}`)
      lines.push("")
    }
    if (observations.length > 0) {
      lines.push("## Observations", "")
      for (const o of observations) lines.push(`- ${o}`)
      lines.push("")
    }

    const targetPath = pathSvc.join(resolvedDir, `drop-${sid}.md`)
    const tmpPath = `${targetPath}.tmp`
    yield* fs.writeFileString(tmpPath, lines.join("\n")).pipe(Effect.orElseSucceed(() => void 0))
    yield* fs.rename(tmpPath, targetPath).pipe(Effect.orElseSucceed(() => void 0))
    yield* Console.log(`promoted feedback to ${targetPath}`)
  })

export const dropCommand = Command.make(
  "drop",
  {
    sessionId: Argument.string("session-id").pipe(Argument.optional),
    stale: Flag.boolean("stale").pipe(Flag.withDefault(false)),
    promote: Flag.boolean("promote").pipe(Flag.withDefault(false)),
    to: Flag.string("to").pipe(Flag.withDefault("ephemeral")),
  },
  ({ sessionId, stale, promote, to }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const loader = yield* MachineLoader
      const eventLog = yield* EventLog
      const fs = yield* FileSystem
      const pathSvc = yield* Path

      const machine = yield* loader.loadFromFile(config.configPath)

      if (!promote && to !== "ephemeral") {
        yield* Console.error("--to requires --promote")
        return
      }

      if (promote) {
        const validSources = machine.memory.dirs.map((d) => d.source)
        if (!validSources.includes(to)) {
          yield* Console.error(`invalid --to value "${to}". Valid: ${validSources.join(", ")}`)
          return
        }
      }

      const targetMemoryDir = machine.memory.dirs.find((d) => d.source === to)?.path ?? ".anakmagang/out/references"

      const processSid = (sid: string) =>
        Effect.gen(function* () {
          if (promote) {
            yield* promoteFeedback(eventLog, sid, fs, pathSvc, config.root, targetMemoryDir)
          }

          yield* dropSession(eventLog, sid)
        })

      if (stale) {
        const sessions = yield* eventLog.listSessions()
        if (sessions.length === 0) {
          yield* Console.log("No sessions found.")
          return
        }
        const droppedRef = yield* Ref.make(0)
        for (const sid of sessions) {
          const active = yield* eventLog.isActive(sid)
          if (!active) {
            if (promote) {
              yield* promoteFeedback(eventLog, sid, fs, pathSvc, config.root, targetMemoryDir)
            }
            yield* dropSession(eventLog, sid)
            yield* Ref.update(droppedRef, (n) => n + 1)
          }
        }
        const dropped = yield* Ref.get(droppedRef)
        if (dropped === 0) {
          yield* Console.log("No stale sessions found.")
        }
        return
      }

      if (Option.isNone(sessionId)) {
        yield* Console.error("session-id required (or use --stale)")
        return
      }

      yield* processSid(sessionId.value)
    }).pipe(Effect.provide(DropLayers)),
)
