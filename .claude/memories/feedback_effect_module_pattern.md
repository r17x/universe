---
name: Effect Module Targeted Refactor Pattern
description: Canonical shape for Effect-TS modules - three zones, no manual types, no comments
type: feedback
updated: 2026-05-21
---

Effect modules must follow the three-zone pattern: DEPENDENCY -> DECLARED -> return SHAPE_OF_DECLARED.

**Why:** Consistency across the anakmagang codebase. Clean separation makes modules scannable and predictable.

**How to apply:**
- Zone 1 (DEPENDENCY): All `yield*` service access at the top
- Zone 2 (DECLARED): All implementations as named const bindings using those deps
- Zone 3 (return): Plain object of declared names — no logic, no inline methods
- No explicit type annotations — rely on inference for naturally correct types
- No code comments except a single top-of-file comment explaining what the module exists for
- No logic in the return block — just `{ name1, name2, name3 }`