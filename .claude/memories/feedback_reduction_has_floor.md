---
name: Code reduction has a mathematical floor
description: Consolidation moves code, it doesn't eliminate it — compute the theoretical minimum before committing to a target
type: feedback
updated: 2026-05-11
---

Refactoring for reduction is a function: `f(modules) → min_lines`. Inlining a module into another moves its body — the line count delta approaches zero. Real reduction comes from eliminating duplication (merging two implementations into one parameterized function).

**Why:** Attempted to reduce a PR from ~3,900 to 2,000 additions. Analysis showed the floor was ~2,400 because one subsystem alone was 964 lines of irreducible new functionality. Inlining thin wrappers saved <50 lines total. UI deduplication (two screens → one parameterized screen) provided 88% of actual savings.

**How to apply:** Before committing to a reduction target, compute the floor: sum all irreducible new functionality, subtract only true duplications. If the target is below the floor, say so immediately — don't waste cycles on cosmetic consolidation that moves code without removing it.
