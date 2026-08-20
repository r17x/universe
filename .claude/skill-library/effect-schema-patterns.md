# Effect-TS Schema Patterns

Tier 2 reference — Schema definitions, TaggedEnum, Match, decode/encode, data modeling.

## Schema Struct Definitions

```typescript
export const AuditResultSchema = Schema.Struct({
  phase: Schema.Number,
  check: Schema.String,
  status: Schema.Literals(["pass", "warn", "fail"]),
  message: Schema.String,
})
export type AuditResult = typeof AuditResultSchema.Type

export const FindOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
})
export type FindOptsEncoded = typeof FindOpts.Encoded
```

Derive types from schemas (`typeof MySchema.Type`), use `Schema.Literals` for union enums, `Schema.OptionFromOptional` for absent fields.

## Data.TaggedEnum with Pattern Matching

```typescript
export type GuardResult = Data.TaggedEnum<{
  Allow: {}
  Warn: { readonly message: string }
  Block: { readonly message: string }
}>

export const { Allow, Warn, Block, $is, $match } = Data.taggedEnum<GuardResult>()
```

### $match — exhaustive pattern matching

```typescript
export const emissionChannel: (emission: Emission) => { channel: Channel; priority: Priority } =
  $match({
    Diagnostic: () => ({ channel: "stderr" as const, priority: Priority.Render }),
    Line: () => ({ channel: "stdout" as const, priority: Priority.Data }),
    Record: () => ({ channel: "stdout" as const, priority: Priority.Data }),
    Table: () => ({ channel: "stdout" as const, priority: Priority.Data }),
    Document: () => ({ channel: "stdout" as const, priority: Priority.Data }),
  })
```

### $is — type guard

```typescript
if (Arr.last(acc).pipe(Option.filter($is("Block")), Option.isSome)) return Effect.succeed(acc)
```

## Match Module

```typescript
const prettyPrintValue = (value: YamlValue, indent = 0): string => {
  const spaces = "  ".repeat(indent)
  return Match.value(value).pipe(
    Match.when({ type: "YamlScalar" }, (node): string => {
      if (node.value === null) return "null"
      return String(node.value)
    }),
    Match.when({ type: "YamlList" }, (node): string => {
      if (node.items.length === 0) return "[]"
      return node.items
        .map((item) => `${spaces}- ${prettyPrintValue(item, indent + 1).trim()}`)
        .join("\n")
    }),
    Match.when({ type: "YamlMap" }, (node): string => {
      if (node.entries.length === 0) return "{}"
      return node.entries
        .map(({ key, value: v }) => `${spaces}${key}: ${prettyPrintValue(v, indent + 1).trim()}`)
        .join("\n")
    }),
    Match.exhaustive,
  )
}
```

**Rules:**
- `Match.value(x).pipe(Match.when(...), ..., Match.exhaustive)` for ad-hoc matching
- Always end with `Match.exhaustive` to enforce completeness
- Prefer `$match` (from TaggedEnum) when matching on your own tagged enums

## Schema Decode / Encode

### decodeUnknownEffect — async/fallible

```typescript
const input = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(HookInputSchema))(stdinText)
  .pipe(Effect.orElseSucceed((): HookInput => ({})))

const validated = yield* Schema.decodeUnknownEffect(MachineConfig)(updated).pipe(
  Effect.tapError((e) =>
    output.emit(Diagnostic({ severity: "error", message: `Validation failed: ${String(e)}` }))
  ),
)
```

### decodeUnknownOption — pure/optional

```typescript
Schema.decodeUnknownOption(MemoryConfigSchema)(parsed).pipe(
  Option.map((c) => c.memory.dirs.map((d): MemoryDir => ({ path: d.path, source: d.source }))),
  Option.filter((dirs) => dirs.length > 0),
  Option.getOrElse(() => DEFAULT_DIRS),
)
```

### encodeEffect — async

```typescript
const json = yield* Schema.encodeEffect(Schema.fromJsonString(AuditReportsSchema))(reports)
```

### Sync variants — inside Effect.try

```typescript
Schema.encodeSync(Schema.fromJsonString(schema))(data)
Schema.decodeUnknownSync(Schema.fromJsonString(schema))(content)
```

## Schema.fromJsonString — Bidirectional JSON Codec

`Schema.fromJsonString(MySchema)` creates a codec that handles both `string -> T` (decode) and `T -> string` (encode). Use it instead of `JSON.parse` / `JSON.stringify`.

```typescript
// Encoding: T -> JSON string
Schema.encodeSync(Schema.fromJsonString(schema))(data)

// Decoding: JSON string -> T
Schema.decodeUnknownSync(Schema.fromJsonString(schema))(content)
```

## Anti-Patterns

| Do NOT | Do Instead |
|--------|-----------|
| `JSON.parse(str)` | `Schema.decodeUnknownEffect(Schema.fromJsonString(MySchema))(str)` |
| `JSON.stringify(data)` | `Schema.encodeSync(Schema.fromJsonString(MySchema))(data)` |
| `globalThis.JSON.stringify` (TS44 hack) | Fix with Schema codec |
| `as MyType` on parsed data | `Schema.decodeUnknownEffect(MySchema)(data)` |
| Manual interface for schema shape | `typeof MySchema.Type` |
| Ignoring TS44 (preferSchemaOverJson) | It is a real type error — fix with Schema |
