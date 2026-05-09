import { Argument, Command } from "effect/unstable/cli"
import { Console, Effect, Layer, Option, Schema } from "effect"
import { Config } from "./Config"
import { EventLog } from "./EventLog"

const StateOutput = Schema.Struct({
  session: Schema.String,
  active: Schema.Boolean,
  current_task: Schema.String,
  current_phase: Schema.String,
  task_size: Schema.String,
  completed_phases: Schema.Array(Schema.String),
  reflections: Schema.Array(Schema.Struct({ phase: Schema.String, reflection: Schema.String })),
  observations: Schema.Array(Schema.String),
})

const StateLayers = Layer.mergeAll(Config.layer, EventLog.layer)

export const stateCommand = Command.make(
  "state",
  { sessionId: Argument.string("session-id").pipe(Argument.optional) },
  ({ sessionId }) =>
    Effect.gen(function* () {
      const eventLog = yield* EventLog

      if (Option.isNone(sessionId)) {
        const sessions = yield* eventLog.listSessions()
        if (sessions.length === 0) {
          yield* Console.log("No sessions found.")
          return
        }
        for (const sid of sessions) {
          const task = (yield* eventLog.currentTask(sid)) ?? "none"
          const phase = (yield* eventLog.currentPhase(sid)) ?? "none"
          yield* Console.log(`${sid}  task=${task}  phase=${phase}`)
        }
        return
      }

      const sid = sessionId.value
      const task = (yield* eventLog.currentTask(sid)) ?? "none"
      const phase = (yield* eventLog.currentPhase(sid)) ?? "none"
      const size = (yield* eventLog.taskSize(sid)) ?? "none"
      const completed = yield* eventLog.completedPhases(sid)
      const reflections = yield* eventLog.reflections(sid)
      const observations = yield* eventLog.observations(sid)
      const active = yield* eventLog.isActive(sid)

      const state = {
        session: sid,
        active,
        current_task: task,
        current_phase: phase,
        task_size: size,
        completed_phases: completed,
        reflections: reflections.map((r) => ({ phase: r.phase, reflection: r.reflection })),
        observations,
      }

      yield* Console.log(Schema.encodeSync(Schema.fromJsonString(StateOutput))(state))
    }).pipe(Effect.provide(StateLayers)),
)
