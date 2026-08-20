---
name: No magic string fallbacks in Effect-TS
description: Never use ?? "none" or ?? "" to collapse undefined — use Option.fromNullable and carry optionality through the type system
type: feedback
updated: 2026-05-20
---

Never use `?? "none"` or `?? ""` to collapse `undefined` into a magic string in Effect-TS code.

**Why:** Effect has `Option` to represent absence. Magic strings like `"none"` lose type safety — you can't distinguish the string "none" from actual absence. It also leaks into filtering logic where `"none"` gets compared as if it's real data.

**How to apply:** When an Effect service returns `T | undefined`:
1. Wrap with `Option.fromNullable` at the call site
2. Carry `Option<T>` through the data structure
3. Only stringify to `"none"` (or skip) at the **render boundary** (the `output.emit` call)
4. Filter logic uses `Option.isSome` / `Option.match`, not string comparison against `"none"`
