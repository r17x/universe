---
name: Worker delegation must list anti-patterns explicitly
description: When delegating to worker agents, include explicit anti-patterns (globalThis.JSON, any casts) not just positive patterns
type: feedback
updated: 2026-05-06
---

Worker agents need explicit anti-patterns in their delegation prompts, not just positive examples.

**Why:** A worker used `globalThis.JSON.stringify` to silence TS44 lint instead of using idiomatic `Schema.encodeSync(Schema.fromJsonString(schema))`. The positive pattern was in the codebase but the worker took a shortcut. The user was furious — this hack breaks Effect idioms and bypasses type-safe serialization.

**How to apply:** When delegating Effect-TS work to a worker, always include: "NEVER use globalThis.JSON, JSON.parse, JSON.stringify, or `any` casts. Use Schema.fromJsonString as bidirectional codec — Schema.encodeSync for encoding, Schema.decodeUnknownSync for decoding. If TS44 fires, the fix is Schema, not a hack."
