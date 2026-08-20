# Effect-TS CLI Patterns

Tier 2 reference for Effect 4.x CLI commands, flags, arguments, and entry points.

## Imports

```typescript
import { Command, Flag, Argument } from "effect/unstable/cli"
import { BunServices } from "effect/unstable/BunServices"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { Schema, Effect, Console, Option } from "effect"
```

## Thin Command Pattern

Commands are thin: parse args, call service, render output.

```typescript
const configGetCommand = Command.make(
  "get",
  {
    path: Argument.string("path").pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  ({ path: dotPath }) =>
    Effect.gen(function* () {
      const output = yield* Output
      const { plain } = yield* readAndParseConfig
      const segments = dotPath.split(".")
      const value = getByPath(plain, segments)
      if (value === undefined) {
        yield* output.emit(Diagnostic({ severity: "error", message: `Key not found: ${dotPath}` }))
      } else {
        yield* output.emit(Line({ text: formatValue(value) }))
      }
    }).pipe(Effect.provide(ConfigLayers)),
)
```

## Flag Types

```typescript
// String flag with alias and optional
Flag.string("preset").pipe(
  Flag.withAlias("p"),
  Flag.optional,
  Flag.withDescription("Load from bundled preset"),
)

// Path flag (validated path)
Flag.path("from").pipe(
  Flag.withAlias("f"),
  Flag.optional,
  Flag.withDescription("Load from custom config file"),
)

// Directory flag with default from Effect
Flag.directory("target").pipe(
  Flag.withAlias("t"),
  Flag.withDefault(Effect.gen(function* () { const p = yield* Path; return p.resolve(".") })),
  Flag.withDescription("Target project directory"),
)

// Boolean flag with default
Flag.boolean("force").pipe(
  Flag.withAlias("F"),
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing config"),
)
```

## Optional Flag Handling

`Flag.optional` wraps the value in `Option`. Use `Option.getOrUndefined` to extract.

```typescript
const preset = Option.getOrUndefined(config.preset)
const from = Option.getOrUndefined(config.from)
if (preset && from) {
  yield* output.emit(Diagnostic({ severity: "error", message: "Cannot use both --preset and --from" }))
  return yield* new MachineLoadError({ source: "init", message: "Conflicting config sources" })
}
```

## Subcommands and Root Command

```typescript
const command = Command.make("anakmagang", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output
    yield* output.emit(Line({ text: "Anakmagang" }))
  })
)

const app = Command.withSubcommands(command, [
  initCommand, searchCommand, hookCommand, memoryCommand, auditCommand,
  statusCommand, stateCommand, startCommand, nextCommand, configCommand,
])

export const cli = Command.run(app, { version: "0.1.0" })
```

## Entry Point (bin.ts)

```typescript
import { BunServices } from "effect/unstable/BunServices"
import { cli } from "./cli.js"

cli(process.argv).pipe(
  Effect.provide(BunServices.layer),
  Effect.runFork,
)
```

## Output Emission

Use the `Output` service with structured emissions. Never use `console.log`.

```typescript
const output = yield* Output
yield* output.emit(Line({ text: "message" }))
yield* output.emit(Diagnostic({ severity: "error", message: "failed" }))
yield* output.emit(Table({ headers: ["Name", "Value"], rows: data }))
yield* output.emit(Document({ content: yaml, mediaType: "yaml" }))
```

## Layer Provision in Commands

```typescript
// Per-command layers (domain-specific, provided at command scope)
const cmd = Command.make("load", { file: Flag.string("file") }, ({ file }) =>
  Effect.gen(function* () {
    const loader = yield* Loader
    const config = yield* loader.load(file.value)
    yield* Console.log(JSON.stringify(config, null, 2))
  }).pipe(Effect.provide(Loader.layer))
)

// Shared layers merged for reuse across commands
const ConfigLayers = Layer.mergeAll(Config.layer, MachineLoader.layer)
```

## Anti-Patterns

- **Fat commands**: Business logic belongs in services, not command handlers.
- **`console.log`**: Use `Output.emit` with structured emissions.
- **Missing `BunServices.layer`**: Entry point must provide it or Stdio is unavailable.
- **`Command.run(cmd, { name, version })`**: No `name` field. Use `{ version }` only.
- **`import { Command } from "@effect/cli"`**: Wrong package. Use `effect/unstable/cli`.
- **Inline layer construction in handlers**: Prefer static `Service.layer` references.
