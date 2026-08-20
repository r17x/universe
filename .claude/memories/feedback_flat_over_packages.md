---
name: Flat structure over package splitting
description: User rejects multi-package proposals — use Effect services + layers for boundaries within flat src/
type: feedback
---

Stay within existing project structure. Do not propose package splitting or monorepo restructuring.

**Why:** User rejected `@anakmagang/core`, `@anakmagang/engine-local`, `@anakmagang/engine-workflow` proposal — it increases structural complexity without benefit. Effect's `Context.Service` with different `Layer` implementations achieves the same boundary clarity within a flat `src/` directory.

**How to apply:** When designing module boundaries, use new `.ts` files in the existing `src/` directory with clear JSDoc module headers. Never propose separate packages, workspaces, or `@scope/name` structures unless the user initiates it.
