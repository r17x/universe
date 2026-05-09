import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Layer, Schema } from "effect"
import { PhaseEngine } from "./PhaseEngine"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { MemoryStore } from "./MemoryStore"
import { EventLog } from "./EventLog"

const ObserveLayers = PhaseEngine.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(MachineLoader.layer, Config.layer, MemoryStore.layerWithSearch, EventLog.layer)),
)

export const observeCommand = Command.make(
  "observe",
  {
    text: Argument.string("text").pipe(Argument.withSchema(Schema.NonEmptyString)),
    session: Flag.string("session"),
  },
  ({ text, session }) =>
    Effect.gen(function* () {
      const engine = yield* PhaseEngine
      yield* engine.observe(text, session)
      yield* Console.log("observed")
    }).pipe(Effect.provide(ObserveLayers)),
)
