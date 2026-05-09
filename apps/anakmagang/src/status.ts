import { Command } from "effect/unstable/cli"
import { Console, Effect } from "effect"
import { EventLog } from "./EventLog"

export const statusCommand = Command.make("status", {}, () =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog

    const sessions = yield* eventLog.listSessions()

    if (sessions.length === 0) {
      return yield* Console.log("No sessions")
    }

    for (const sid of sessions) {
      const active = yield* eventLog.isActive(sid)
      const task = (yield* eventLog.currentTask(sid)) ?? "none"
      const phase = (yield* eventLog.currentPhase(sid)) ?? "none"
      const size = (yield* eventLog.taskSize(sid)) ?? "none"
      const status = active ? "ACTIVE" : "DONE"

      yield* Console.log(`${sid} | ${status} | ${phase} | ${size} | ${task}`)
    }
  }).pipe(Effect.provide(EventLog.layer)),
)
