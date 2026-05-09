import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Layer, Schema } from "effect"
import { Config } from "./Config"
import { EventLog } from "./EventLog"

const UpdateLayers = Layer.mergeAll(Config.layer, EventLog.layer)

export const updateCommand = Command.make(
  "update",
  {
    key: Argument.string("key").pipe(Argument.withSchema(Schema.NonEmptyString)),
    value: Argument.string("value").pipe(Argument.withSchema(Schema.NonEmptyString)),
    session: Flag.string("session"),
  },
  ({ key, value, session }) =>
    Effect.gen(function* () {
      const eventLog = yield* EventLog

      const ts = new Date().toISOString()
      yield* eventLog.appendManifest(session, { type: "observation", text: `${key}: ${value}`, ts })
      yield* Console.log(`${session} | observation: ${key}: ${value}`)
    }).pipe(Effect.provide(UpdateLayers)),
)
