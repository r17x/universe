---
name: Effect TS errors are real errors
description: Never skip or dismiss Effect language service messages (TS15, TS44, TS18) - they are real type errors
type: feedback
updated: 2026-05-05
---

Effect language service messages (TS15, TS44, TS18) are REAL TYPE ERRORS, not lint suggestions.

**Why:** The Effect TypeScript language service enforces idiomatic Effect patterns. Violations like try/catch in Effect generators (TS15), raw JSON.parse instead of Schema (TS44), and other patterns are considered errors by the project.

**How to apply:** When running tsc --noEmit, never filter out or dismiss these messages. Fix them:
- TS15 (tryCatchInEffectGen): Replace try/catch with Effect.try, Effect.tryPromise, Effect.catch, Effect.catchTag
- TS44 (preferSchemaOverJson): Replace JSON.parse/JSON.stringify with Effect Schema decode/encode
- TS18 and others: Always investigate and fix
