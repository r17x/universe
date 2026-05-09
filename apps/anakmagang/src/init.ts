import { Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option } from "effect"
import { Path } from "effect/Path"
import { MachineLoader, MachineLoadError } from "./MachineLoader"
import { syncHooksToSettings } from "./hook.sync"

export const initCommand = Command.make(
  "init",
  {
    preset: Flag.string("preset").pipe(
      Flag.withAlias("p"),
      Flag.optional,
      Flag.withDescription("Load from bundled preset"),
    ),
    from: Flag.path("from").pipe(
      Flag.withAlias("f"),
      Flag.optional,
      Flag.withDescription("Load from custom config file"),
    ),
    target: Flag.directory("target").pipe(
      Flag.withAlias("t"),
      Flag.withDefault(Effect.gen(function* () { const p = yield* Path; return p.resolve(".") })),
      Flag.withDescription("Target project directory (defaults to cwd)"),
    ),
    force: Flag.boolean("force").pipe(
      Flag.withAlias("F"),
      Flag.withDefault(false),
      Flag.withDescription("Overwrite existing config"),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      const loader = yield* MachineLoader

      const preset = Option.getOrUndefined(config.preset)
      const from = Option.getOrUndefined(config.from)
      if (preset && from) {
        yield* Console.error("Cannot use both --preset and --from")
        return yield* new MachineLoadError({
          source: "init",
          message: "Conflicting config sources",
        })
      }

      const machineConfig = from
        ? yield* loader.loadFromFile(from)
        : yield* loader.loadPreset(preset ?? "r17x-orchestrate")

      yield* Console.info(`Initializing ${machineConfig.name} in ${config.target}`)

      const results = yield* loader.generate(machineConfig, config.target, { force: config.force })

      const created = results.filter((r) => r.status === "created")
      const skipped = results.filter((r) => r.status === "skipped")
      const updated = results.filter((r) => r.status === "updated")

      if (created.length > 0) {
        yield* Console.info(`Created ${created.length} file(s):`)
        for (const f of created) {
          yield* Console.info(`  + ${f.path}`)
        }
      }
      if (updated.length > 0) {
        yield* Console.info(`Updated ${updated.length} file(s):`)
        for (const f of updated) {
          yield* Console.info(`  ~ ${f.path}`)
        }
      }
      if (skipped.length > 0) {
        yield* Console.info(`Skipped ${skipped.length} file(s) (already exist)`)
      }

      const guardsWithEvents = (machineConfig.guards ?? []).filter(
        (g) => g.event !== undefined && g.enforced_by === "hook",
      )
      if (guardsWithEvents.length > 0) {
        const settingsPath = yield* syncHooksToSettings(machineConfig.guards ?? [], config.target)
        yield* Console.info(`Synced hooks to ${settingsPath}`)
      }

      yield* Console.info("Done.")
    }).pipe(Effect.provide(MachineLoader.layer)),
)
