---
name: Algebraic Effect flow — all monads lift into Effect
description: Inside Effect context, all monadic types (Option, Either, Stream, etc.) must be lifted into Effect — never nest monads inside Effect or escape them with throws
type: feedback
updated: 2026-05-10
---

Inside an Effect generator, data flows through ONE algebraic structure: Effect. All other monadic types must be lifted into Effect's channels — never nested, never escaped via throws.

**Why:** Nesting monads (Option.match returning Effect, Either.match returning Effect) creates double-encoding — two layers of algebraic structure fighting for control flow. Escaping monads (Option.getOrThrowWith, Either.getOrThrow) breaks Effect's contract by side-effecting outside its error channel. The principle: "data should flow without side-effect even if effectfully."

**How to apply:**

Every monad has a bridge into Effect:
- `Option<A>` → `Effect.fromOption` (None becomes NoSuchElementException)
- `Either<E, A>` → `Effect.fromEither` (Left becomes the error)
- `Cause<E>` → `Effect.failCause`
- `Exit<A, E>` → `Effect.fromExit`
- `Stream<A, E, R>` → `Stream.run` / `Stream.runCollect`

Pattern:
```typescript
// ✅ Algebraic — monad lifted into Effect
yield* Arr.head(collection).pipe(Effect.fromOption, Effect.orDie)
yield* Schema.decodeEither(schema)(input).pipe(Effect.fromEither)

// ❌ Anti-pattern — monad nested in Effect
Option.match(value, { onNone: () => Effect.die(...), onSome: Effect.succeed })
Either.match(value, { onLeft: () => Effect.fail(...), onRight: Effect.succeed })

// ❌ Anti-pattern — monad escaped via throw
Option.getOrThrowWith(value, () => new Error(...))
```

Rules:
- NEVER use `.getOrThrow` / `.getOrThrowWith` inside Effect — breaks the algebraic contract
- NEVER use monad `.match` that returns Effect values — use the corresponding `Effect.from*` bridge
- Monads are FINE in pure context (function parameters, pure helpers, outside Effect generators)
- After lifting, use `Effect.orDie` for invariants, `Effect.matchEffect` for recovery, `Effect.mapError` for typed errors

**Codified in:** `.claude/skill-library/effect-error-patterns.md` (Algebraic Effect Flow section)
