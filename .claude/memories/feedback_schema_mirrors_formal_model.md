---
name: Schema must mirror formal model — read spec before writing Schema
description: When a formal model (Preset, Machine SEGA) defines required fields, the Effect Schema MUST make them required — never use Schema.optional for spec-required fields
type: feedback
updated: 2026-05-27
---

When a formal model exists (init-completeness-v5, Machine SEGA), the Effect Schema MUST mirror its structure exactly. Required fields in the model → required fields in the Schema. Optional fields → Schema.optional.

**Why:** Making `phases` and `guards` Schema.optional in Config.ts modeled "a machine without states" — structurally nonsensical. The init-completeness doc defines `Preset { phases :: [PresetPhase], guards :: [PresetGuard] }` as REQUIRED dynamics (s and g). Silent defaults on schema failure hid broken configs instead of surfacing errors.

**How to apply:**
- Before writing any Schema, check if a formal model/spec document exists (init-completeness, ARCHITECTURE.md, config.yaml structure docs)
- Required in the spec → required in the Schema. No exceptions.
- Distinguish file-absent (Option — legitimate absence, e.g. no config.yaml yet) from schema-invalid (Error — the spec is broken, fail loudly)
- `Schema.optional` is only for fields that are genuinely optional in the spec (e.g. `promises` on a guard — not every guard type has promises)
- "Lightweight extraction" means a FOCUSED Schema (only the fields Config needs), NOT a permissive one
