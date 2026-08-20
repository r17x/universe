---
name: Trust tsc effect-language-service warnings
description: All tsc warnings from effect-language-service (TS18, TS37, TS44, etc.) are real issues that must be fixed, including pre-existing ones
type: feedback
updated: 2026-05-29
---

Trust ALL tsc warnings from effect-language-service — they indicate real issues, not suggestions.

**Why:** User explicitly corrected the assumption that pre-existing warnings can be ignored. Effect-language-service warnings catch real anti-patterns (chained Layer.provide causes lifecycle issues, JSON.parse bypasses Schema validation).

**How to apply:** When running `bunx tsc --noEmit`, treat every warning from effect-language-service as an error. Fix them in the same session, even if pre-existing in files you're touching. Key fixes:
- TS18/TS37: Replace chained `Layer.provide` with `Layer.provideMerge` + single `Layer.provide`
- TS44: Replace `JSON.parse(...) as T` with `Schema.decodeUnknownEffect(Schema.fromJsonString(MySchema))(content)`
- TS5: Remove unnecessary `Effect.gen` wrapping single returns
