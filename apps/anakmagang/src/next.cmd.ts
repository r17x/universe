import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Layer, Option, Schema } from "effect"
import { PhaseEngine } from "./PhaseEngine"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { MemoryStore } from "./MemoryStore"
import { EventLog } from "./EventLog"

const NextLayers = PhaseEngine.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(MachineLoader.layer, Config.layer, MemoryStore.layerWithSearch, EventLog.layer)),
)

export const nextCommand = Command.make(
  "next",
  {
    answer: Argument.string("answer").pipe(Argument.withSchema(Schema.NonEmptyString)),
    session: Flag.string("session"),
    size: Flag.string("size").pipe(Flag.withAlias("s"), Flag.optional),
  },
  ({ answer, session, size }) =>
    Effect.gen(function* () {
      const engine = yield* PhaseEngine
      const sizeValue = Option.getOrUndefined(size)
      const result = yield* engine.next(answer, session, sizeValue)
      if (result._tag === "Completed") {
        yield* Console.log(`${result.sessionId} | COMPLETE`)
      } else {
        yield* Console.log(`${result.sessionId} | ${result.phase.number}/${result.phase.id} | Q: ${result.question}`)
      }
    }).pipe(Effect.provide(NextLayers)),
)
