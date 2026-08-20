---
name: No manual _tag in Schema
description: Never use Schema.tag() or manual _tag fields — use Schema.TaggedStruct for tagged unions
type: feedback
updated: 2026-05-31
---

Never use `Schema.tag("X")` or manual `_tag` fields in Schema definitions. `Schema.tag` does not exist in the project's Effect version and causes runtime errors.

**Why:** `Schema.tag` is not available. The project uses `Schema.TaggedStruct("TagName", { fields })` for tagged union variants, combined with `Schema.Union([...])` (array form). See `DomainEvent.ts` for the canonical pattern.

**How to apply:** When defining Schema-encoded tagged unions, always use:
```typescript
Schema.Union([
  Schema.TaggedStruct("VariantA", { field: Schema.String }),
  Schema.TaggedStruct("VariantB", { field: Schema.Number }),
])
```
Never use `Schema.Class` with `_tag: Schema.tag(...)`. Also: `Schema.optionalWith` does not exist — use `Schema.optional` instead.
