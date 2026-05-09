import { Context, Data, Effect, Layer } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { PlatformError } from "effect/PlatformError"
export class ConfigNotFound extends Data.TaggedError("ConfigNotFound")<{
  readonly path: string
  readonly message: string
}> { }
export interface ConfigContract {
  readonly root: string
  readonly configPath: string
  readonly outDir: string
  readonly readConfig: Effect.Effect<string, ConfigNotFound>
}

export class Config extends Context.Service<Config, ConfigContract>()("@anakmagang/Config") {
  static readonly layer = Layer.effect(
    Config,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const path = yield* Path

      const readFile = Effect.fn("Config.readFile")(function* (filePath: string) {
        return yield* fs.readFileString(filePath).pipe(
          Effect.mapError(() => new ConfigNotFound({ path: filePath, message: `File not found: ${filePath}` }))
        )
      })

      const cwd = path.resolve(".")

      const walkUp = (dir: string, depth: number): Effect.Effect<string, PlatformError> =>
        depth >= 10
          ? Effect.succeed(cwd)
          : fs.exists(path.join(dir, ".anakmagang", "config.yaml")).pipe(
            Effect.flatMap((exists) => {
              if (exists) return Effect.succeed(dir)
              const parent = path.dirname(dir)
              if (parent === dir) return Effect.succeed(cwd)
              return Effect.suspend(() => walkUp(parent, depth + 1))
            })
          )

      const root = yield* walkUp(cwd, 0)
      const configPath = path.join(root, ".anakmagang", "config.yaml")

      return {
        root,
        configPath,
        outDir: path.join(root, ".anakmagang", "out"),
        readConfig: readFile(configPath),
      }
    })
  )
}
