import { Command } from "effect/unstable/cli"
import { Console, Effect, Layer, Schema } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"

const HookEntrySchema = Schema.Struct({
  type: Schema.String,
  command: Schema.String,
  timeout: Schema.optional(Schema.Number),
})

const HookMatcherSchema = Schema.Struct({
  matcher: Schema.optional(Schema.String),
  hooks: Schema.Array(HookEntrySchema),
})

export interface SyncableGuard {
  readonly event?: string | undefined
  readonly enforced_by?: string | undefined
  readonly timeout?: number | undefined
}

export const syncHooksToSettings = (
  guards: ReadonlyArray<SyncableGuard>,
  rootDir: string,
): Effect.Effect<string, never, FileSystem | Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem
    const path = yield* Path

    const hookGuards = guards.filter(
      (g) => g.event !== undefined && g.enforced_by === "hook",
    )

    const statusLineGuards = guards.filter(
      (g) => g.event === "statusLine",
    )

    const eventGroups = new Map<string, typeof hookGuards>()
    for (const g of hookGuards) {
      const event = g.event!
      const existing = eventGroups.get(event) ?? []
      eventGroups.set(event, [...existing, g])
    }

    type HookMatcher = typeof HookMatcherSchema.Type
    const hooks: Record<string, readonly HookMatcher[]> = {}

    for (const [event, eventGuards] of eventGroups) {
      const maxTimeout = Math.max(...eventGuards.map((g) => g.timeout ?? 5))
      hooks[event] = [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: `anakmagang hook eval --event ${event}`,
              timeout: maxTimeout,
            },
          ],
        },
      ]
    }

    const settingsPath = path.join(rootDir, ".claude", "settings.json")
    const existingExists = yield* fs.exists(settingsPath).pipe(Effect.orElseSucceed(() => false))

    const existing: Record<string, unknown> = existingExists
      ? yield* fs.readFileString(settingsPath).pipe(
          Effect.flatMap((raw) =>
            Schema.decodeUnknownEffect(
              Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
            )(raw)
          ),
          Effect.orElseSucceed((): Record<string, unknown> => ({})),
        )
      : {}

    const settings: Record<string, unknown> = {
      ...existing,
      hooks,
      ...(statusLineGuards.length > 0
        ? { statusLine: { type: "command", command: "anakmagang hook eval --event statusLine" } }
        : {}),
    }

    const output = yield* Schema.encodeEffect(
      Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
    )(settings).pipe(
      Effect.orElseSucceed(() => "{}"),
      Effect.map((s) => s + "\n"),
    )

    yield* fs.makeDirectory(path.join(rootDir, ".claude"), { recursive: true }).pipe(
      Effect.orElseSucceed(() => void 0),
    )
    yield* fs.writeFileString(settingsPath, output).pipe(Effect.orDie)

    return settingsPath
  })

export const hookSyncCommand = Command.make(
  "sync",
  {},
  () =>
    Effect.gen(function* () {
      const config = yield* Config
      const loader = yield* MachineLoader
      const machine = yield* loader.loadFromFile(config.configPath)
      const guards = machine.guards ?? []

      const settingsPath = yield* syncHooksToSettings(guards, config.root)

      const hookGuards = guards.filter(
        (g) => g.event !== undefined && g.enforced_by === "hook",
      )
      const eventGroups = new Set(hookGuards.map((g) => g.event!))

      yield* Console.log(`Synced ${eventGroups.size} hook events to ${settingsPath}`)
    }).pipe(Effect.provide(Layer.merge(MachineLoader.layer, Config.layer))),
)
