# Effect-TS Error Patterns

Tier 2 reference for error definition, algebraic effect flow, and error recovery in Effect 4.x.

## Tagged Errors

All domain errors extend `Data.TaggedError` with a unique tag and typed fields.

```typescript
import { Data } from "effect"

export class ConfigNotFound extends Data.TaggedError("ConfigNotFound")<{
  readonly path: string
  readonly message: string
}> {}

export class ProtocolError extends Data.TaggedError("ProtocolError")<{
  readonly code: string
  readonly service: string
  readonly operation: string
  readonly message: string
  readonly recovery: Recovery
  readonly cause?: unknown
}> {}

export class EventLogError extends Data.TaggedError("EventLogError")<{
  readonly sid: string
  readonly message: string
}> {}
```

Keep 1-2 errors per service. Co-locate errors with the owning service file.

## Algebraic Effect Flow

Inside Effect generators, all monadic types lift into Effect through bridges. Never pattern-match monads into Effect values.

### Bridge Table

| Source | Bridge | Error on failure |
|--------|--------|-----------------|
| `Option<A>` | `Effect.fromOption` | `NoSuchElementException` |
| `Either<E, A>` | `Effect.fromEither` | Left value becomes error |
| `Cause<E>` | `Effect.failCause` | Cause becomes defect/failure |
| `Exit<A, E>` | `Effect.fromExit` | Failure side preserved |

### Correct Usage

```typescript
// Option → Effect (die on None — invariant)
const firstPhase = yield* Arr.head(machine.phases).pipe(
  Effect.fromOption,
  Effect.orDie,
)

// Either → Effect
yield* Schema.decodeEither(schema)(input).pipe(Effect.fromEither)

// Option → Effect with typed error
yield* Arr.get(activePhases, currentIdx).pipe(
  Effect.fromOption,
  Effect.mapError(() => new PhaseEngineError({ message: "Phase not found" })),
)
```

### Anti-Patterns

```typescript
// ❌ Nested monads — double-encoding
Option.match(value, { onNone: () => Effect.die(...), onSome: Effect.succeed })

// ❌ Escaping monads via throw
Option.getOrThrowWith(value, () => new Error(...))

// ❌ Either.match returning Effect
Either.match(value, { onLeft: () => Effect.fail(...), onRight: Effect.succeed })
```

Always use the bridge function, then transform the error channel.

## Error Recovery

### Effect.catch — recover from typed errors with fallback

```typescript
const getRoutes = archParser.getDomainRouting().pipe(
  Effect.catch(() => Effect.succeed<readonly DomainRoute[]>([]))
)
```

### Effect.orDie — promote to defect (impossible states only)

```typescript
const dirExists = yield* fs.exists(d.resolved).pipe(Effect.orDie)
```

### Effect.orElseSucceed — optional value recovery

```typescript
eventLog.readJson(session, "claude", claudeSid, BridgeData).pipe(
  Effect.orElseSucceed(() => undefined),
)
```

### Effect.mapError — typed error wrapping

```typescript
yield* fs.readFileString(filePath).pipe(
  Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot read file" }))
)
```

### Effect.try — wrapping non-Effect code

```typescript
yield* Effect.try({
  try: () => Schema.decodeUnknownSync(Schema.fromJsonString(schema))(content),
  catch: (e) => new EventLogError({ sid, message: `Failed to parse: ${String(e)}` }),
})
```

## Error-First Effect.fn Methods

Service methods use `Effect.fn` for tracing. Map errors at each effectful call site.

```typescript
const writeAtomic = Effect.fn("MemoryStore.writeAtomic")(function* (target: string, content: string) {
  const tmp = `${target}.tmp`
  yield* fs.writeFileString(tmp, content).pipe(
    Effect.mapError(() => new MemoryNodeError({ id: target, message: `Failed to write temp: ${tmp}` }))
  )
  yield* fs.rename(tmp, target).pipe(
    Effect.mapError(() => new MemoryNodeError({ id: target, message: `Failed to rename: ${tmp} -> ${target}` }))
  )
})
```

## process.exit in Effect Context

Wrap `process.exit` in `Effect.sync` at program boundaries only.

```typescript
if (Option.isSome(block)) {
  yield* output.emit(Diagnostic({ severity: "error", message: block.value.message }))
  return yield* Effect.sync(() => process.exit(2))
}
```

## Rules

- NEVER use `throw new Error(...)` — use `Effect.fail(new TaggedError({...}))`
- NEVER use `try/catch` — use `Effect.try({ try, catch })`
- NEVER use `.getOrThrow` / `.getOrThrowWith` inside Effect — use `Effect.fromOption` + `Effect.orDie` or `Effect.mapError`
- NEVER use monad `.match` that returns Effect values — use `Effect.from*` bridges
- Effect language service messages (TS15, TS44, TS18) are REAL TYPE ERRORS — fix them, do not suppress
- `Data.TaggedError` NOT `Schema.TaggedError` — Schema.TaggedError does not exist in Effect 4.x
- `Effect.catch` NOT `Effect.catchAll` — the API changed in Effect 4.x
