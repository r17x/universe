import { Argument, Command } from "effect/unstable/cli"
import { Console, Effect, Layer, Schema } from "effect"
import { Config } from "./Config"
import { EventLog } from "./EventLog"

const LogsLayers = Layer.mergeAll(Config.layer, EventLog.layer)

export const logsCommand = Command.make(
  "logs",
  { sessionId: Argument.string("session-id").pipe(Argument.withSchema(Schema.NonEmptyString)) },
  ({ sessionId }) =>
    Effect.gen(function* () {
      const eventLog = yield* EventLog
      const events = yield* eventLog.readRawEvents(sessionId)

      if (events.length === 0) {
        yield* Console.log("No events found.")
        return
      }

      for (const event of events) {
        const ts = event["ts"] ?? ""
        switch (event.type) {
          case "task_start": {
            const size = event["size"] ? ` [${event["size"]}]` : ""
            yield* Console.log(`${ts}  START${size}  ${event["task"] ?? ""}`)
            break
          }
          case "phase_advance": {
            const reflection = event["reflection"] ? `  "${event["reflection"]}"` : ""
            yield* Console.log(`${ts}  PHASE  ${event["phase"] ?? ""}${reflection}`)
            break
          }
          case "observation":
            yield* Console.log(`${ts}  OBS    ${event["text"] ?? ""}`)
            break
          default:
            yield* Console.log(`${ts}  ${event.type}`)
        }
      }
    }).pipe(Effect.provide(LogsLayers)),
)
