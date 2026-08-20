# Effect-TS Service Patterns

## Service Contract Pattern

Every service exports a named contract interface BEFORE the class. Service identifiers use the `@anakmagang/` prefix.

```typescript
// apps/anakmagang/src/Config.ts
import { Context, Data, Effect, Layer } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"

export class ConfigNotFound extends Data.TaggedError("ConfigNotFound")<{
  readonly path: string
  readonly message: string
}> {}

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
      const root = path.resolve(".")
      const configPath = path.join(root, ".anakmagang", "config.yaml")

      const readFile = Effect.fn("Config.readFile")(function* (filePath: string) {
        return yield* fs.readFileString(filePath).pipe(
          Effect.mapError(() => new ConfigNotFound({ path: filePath, message: `File not found: ${filePath}` }))
        )
      })

      return {
        root,
        configPath,
        outDir: path.join(root, ".anakmagang", "out"),
        readConfig: readFile(configPath),
      }
    })
  )
}
```

## Effect.fn for Traced Methods

All service methods use `Effect.fn("Service.method")` for tracing (see `readFile` in example above). Functions compose naturally:

```typescript
// apps/anakmagang/src/EventLog.ts
const readFileOrEmpty = Effect.fn("EventLog.readFileOrEmpty")(function* (filePath: string) {
  const exists = yield* fs.exists(filePath).pipe(Effect.orElseSucceed(() => false))
  if (!exists) return ""
  return yield* fs.readFileString(filePath).pipe(Effect.orElseSucceed(() => ""))
})
```

## Dependency Injection: Close Over, Don't Re-Yield

Yield dependencies once in the `Layer.effect` outer gen. Inner methods close over them.

```typescript
// apps/anakmagang/src/EventLog.ts
export class EventLog extends Context.Service<EventLog, EventLogContract>()("@anakmagang/EventLog") {
  static readonly layer = Layer.effect(
    EventLog,
    Effect.gen(function* () {
      const fs = yield* FileSystem       // yield once
      const p = yield* Path              // yield once
      const config = yield* Config       // yield once

      return {
        appendManifest: Effect.fn("EventLog.appendManifest")(function* (sid, event) {
          // use fs, p, config directly -- closed over from outer gen
        }),
      }
    })
  ).pipe(Layer.provide(Config.layer))
}
```

## Errors

Errors use `Data.TaggedError` with descriptive fields. Co-locate with the owning service (1-2 per service).

```typescript
// apps/anakmagang/src/EventLog.ts
export class EventLogError extends Data.TaggedError("EventLogError")<{
  readonly sid: string
  readonly message: string
}> {}

// apps/anakmagang/src/PhaseEngine.ts
export class PhaseEngineError extends Data.TaggedError("PhaseEngineError")<{
  readonly message: string
}> {}
```

## Layer Composition

```typescript
// Layer.mergeAll — combine independent layers
const ConfigLayers = Layer.mergeAll(Config.layer, MachineLoader.layer)

// Layer.provideMerge — dependent layers (PhaseEngine needs all four)
// apps/anakmagang/src/observe.cmd.ts
const ObserveLayers = PhaseEngine.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(MachineLoader.layer, Config.layer, MemoryStore.layerWithSearch, EventLog.layer)),
)

// Layer.provide on class definition — service declares its own dependency
// apps/anakmagang/src/EventLog.ts
static readonly layer = Layer.effect(EventLog, ...).pipe(Layer.provide(Config.layer))

// Multiple layer variants for different contexts
// apps/anakmagang/src/MemoryStore.ts
static readonly layer = Layer.effect(MemoryStore, ...)
static readonly layerWithSearch = Layer.effect(MemoryStore, ...).pipe(
  Layer.provide(Config.layer),
  Layer.provide(Search.layer),
)
static readonly layerFrom = (dirs: readonly MemoryDir[]) => Layer.effect(MemoryStore, makeStoreContract(dirs))
```

## Thin Commands

Commands parse args, call a service, render output. No business logic.

```typescript
// apps/anakmagang/src/observe.cmd.ts
import { Argument, Command, Flag } from "effect/unstable/cli"
import { Effect, Layer, Schema } from "effect"

export const observeCommand = Command.make(
  "observe",
  {
    text: Argument.string("text").pipe(Argument.withSchema(Schema.NonEmptyString)),
    session: Flag.string("session"),
  },
  ({ text, session }) =>
    Effect.gen(function* () {
      const engine = yield* PhaseEngine
      const output = yield* Output
      yield* engine.observe(text, session)
      yield* output.emit(Line({ text: "observed" }))
    }).pipe(Effect.provide(ObserveLayers)),
)
```

## Transactional Writes (Atomic Multi-File)

Write all temps first, then rename all. Prevents partial writes on failure.

```typescript
// apps/anakmagang/src/MemoryStore.ts — single file
const writeAtomic = Effect.fn("MemoryStore.writeAtomic")(function* (target: string, content: string) {
  const tmp = `${target}.tmp`
  yield* fs.writeFileString(tmp, content).pipe(
    Effect.mapError(() => new MemoryNodeError({ id: target, message: `Failed to write temp: ${tmp}` }))
  )
  yield* fs.rename(tmp, target).pipe(
    Effect.mapError(() => new MemoryNodeError({ id: target, message: `Failed to rename: ${tmp} -> ${target}` }))
  )
})

// apps/anakmagang/src/MemoryStore.ts — batch (temps first, then all renames)
const writeBatch = Effect.fn("MemoryStore.writeBatch")(function* (writes: ReadonlyArray<{ target: string; content: string }>) {
  const temps = yield* Effect.forEach(writes, ({ target, content }) =>
    fs.writeFileString(`${target}.tmp`, content).pipe(
      Effect.as(`${target}.tmp`),
      Effect.mapError(() => new MemoryNodeError({ id: target, message: `Batch temp write failed` }))
    )
  )
  yield* Effect.forEach(Arr.zip(writes, temps), ([{ target }, tmp]) =>
    fs.rename(tmp, target).pipe(
      Effect.mapError(() => new MemoryNodeError({ id: target, message: `Batch rename failed` }))
    )
  )
})
```

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| Inline type in `Context.Service<>` generic | Export a named contract interface |
| `Layer.succeed` for complex services | `Layer.effect` with `Effect.gen` for DI |
| `yield* Dep` inside service methods | Close over from `Layer.effect` outer gen |
| Provider-specific methods (`readClaudeBridge`) | Generic storage (`readJson(sid, ns, key, schema)`) |
| Business logic in command handlers | Thin commands: parse, call service, render |
| Plain functions without tracing | `Effect.fn("Service.method")` everywhere |
| `Schema.TaggedError` | `Data.TaggedError` (Effect 4.x) |
| `Context.Tag` | `Context.Service` (Effect 4.x) |
