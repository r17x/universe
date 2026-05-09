import { Argument, Command } from "effect/unstable/cli"
import { Console, Effect, Layer, Schema } from "effect"
import { PhaseEngine } from "./PhaseEngine"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { MemoryStore } from "./MemoryStore"
import { EventLog } from "./EventLog"

const StartLayers = PhaseEngine.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(MachineLoader.layer, Config.layer, MemoryStore.layerWithSearch, EventLog.layer)),
)

export const startCommand = Command.make(
  "start",
  {
    task: Argument.string("task").pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  ({ task }) =>
    Effect.gen(function* () {
      const engine = yield* PhaseEngine
      const result = yield* engine.start(task)
      yield* Console.log(`${result.sessionId} | ${result.phase.number}/${result.phase.id} | Q: ${result.question}`)
      if (result.memories.length > 0) {
        yield* Console.log("---")
        for (const m of result.memories) {
          yield* Console.log(`Memory[${m.scale}]: ${m.name} — ${m.description}`)
        }
      }
    }).pipe(Effect.provide(StartLayers)),
)
