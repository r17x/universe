---
name: gateway-effect-ts
description: Effect-TS Gateway
updated: "2026-05-12"
---

Routes Effect-TS tasks to the correct worker agent and loads domain-specific skill-library files based on task type.

# Effect-TS Gateway

## When to use

When the task involves TypeScript files under `apps/`, Effect 4.x services, commands, layers, errors, schemas, or anything in the Effect ecosystem.

## Steps

1. **Detect task type** — Examine which area is involved:
   - New service (Context.Service, Layer, DI) → service work
   - Error handling (Data.TaggedError, recovery, algebraic flow) → error work
   - Data modeling (Schema, TaggedEnum, Match) → schema work
   - CLI command (Command, Flag, Argument) → cli work
   - Tests (bun:test, test layers) → testing work
   - Cross-cutting (new feature touching multiple areas) → load multiple

2. **Load relevant Tier 2 skills** based on task type:

   ### Service/Layer work
   ```
   .claude/skill-library/effect-service-patterns.md
   ```

   ### Error handling
   ```
   .claude/skill-library/effect-error-patterns.md
   ```

   ### Schema/Data modeling
   ```
   .claude/skill-library/effect-schema-patterns.md
   ```

   ### CLI commands
   ```
   .claude/skill-library/effect-cli-patterns.md
   ```

   ### Testing
   ```
   .claude/skill-library/effect-testing-patterns.md
   ```

3. **Route to effect-ts agent** — delegate to the worker defined in `.anakmagang/config.yaml` ground.routing for `apps/**/*.ts`
   - All `.ts` files under `apps/` → effect-ts domain worker
   - Non-TS files (`.md`, `.yaml`, `.json`) → handle directly or delegate to default agent
   - Never use domain workers for markdown or config files — use a default agent

4. **Verify with fast commands**:
   ```bash
   # Type check (required)
   nix develop .#anakmagang --command bun run typecheck

   # Run tests
   nix develop .#anakmagang --command bun test

   # Smoke test
   nix develop .#anakmagang --command bun run src/bin.ts --help
   ```

## Output

Worker completion signal forwarded to coordinator:
```
IMPLEMENTATION_COMPLETE | VERIFICATION_PASSED | VERIFICATION_FAILED
```