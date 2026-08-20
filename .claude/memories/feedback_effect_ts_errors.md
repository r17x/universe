---
name: Effect TS idiomatic patterns and errors
description: Write idiomatic Effect-TS — no as casts, no explicit type annotations on variables, use method .pipe() not function pipe(), and never dismiss Effect language service errors
type: feedback
updated: 2026-05-20
---

## Idiomatic Effect-TS Code Style

Three rules for idiomatic Effect code:

1. **Never use `as SomeType` casts.** Use `Effect.succeed<T>(value)` generic parameter if needed for type unification. `as` casts bypass the type system.

2. **Don't annotate variables with explicit types.** Let Effect's inference work. Write `const merged = { ... }` not `const merged: SomeType = { ... }`. Same for lambda return types — `(x) => ...` not `(x): Type => ...`.

3. **Use method `.pipe()` on Effect values, not the `pipe()` function.** Effect values have a `.pipe()` method naturally. Write `myEffect.pipe(Effect.map(...))` not `pipe(myEffect, Effect.map(...))`. Don't import `pipe` from "effect".

**Why:** The user explicitly flagged these as non-idiomatic. Effect-TS has rich type inference — fighting it with casts and annotations produces brittle code that hides real type errors.

**How to apply:** Every time you write Effect code, check for these three patterns. The only exception for type parameters is `Effect.succeed<A | B>(value)` when needed for branch unification in flatMap/match.

## Effect Language Service Errors

Effect language service messages (TS15, TS44, TS18) are REAL TYPE ERRORS, not lint suggestions.

**Why:** The Effect TypeScript language service enforces idiomatic Effect patterns. Violations like try/catch in Effect generators (TS15), raw JSON.parse instead of Schema (TS44), and other patterns are considered errors by the project.

**How to apply:** When running tsc --noEmit, never filter out or dismiss these messages. Fix them:
- TS15 (tryCatchInEffectGen): Replace try/catch with Effect.try, Effect.tryPromise, Effect.catch, Effect.catchTag
- TS44 (preferSchemaOverJson): Replace JSON.parse/JSON.stringify with Effect Schema decode/encode
- TS18 and others: Always investigate and fix
