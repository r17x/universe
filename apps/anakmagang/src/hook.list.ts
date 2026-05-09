import { Command } from "effect/unstable/cli"
import { Console, Effect } from "effect"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { HookLayers } from "./hook"

export const hookListCommand = Command.make(
  "list",
  {},
  () =>
    Effect.gen(function* () {
      const config = yield* Config
      const loader = yield* MachineLoader
      const machine = yield* loader.loadFromFile(config.configPath)
      const guards = machine.guards ?? []
      if (guards.length === 0) {
        yield* Console.log("No guards configured.")
        return
      }
      for (const guard of guards) {
        const parts = [guard.type]
        if (guard.event !== undefined) parts.push(`[${guard.event}]`)
        if (guard.matcher !== undefined) parts.push(`(${guard.matcher})`)
        if (guard.description !== undefined) parts.push(guard.description)
        if (guard.enforced_by !== undefined) parts.push(`enforced_by:${guard.enforced_by}`)
        yield* Console.log(parts.join("  "))
      }
    }).pipe(Effect.provide(HookLayers)),
)
