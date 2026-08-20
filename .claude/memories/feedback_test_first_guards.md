---
name: Write guard tests in test files, not ad-hoc bash
description: When testing guards, write bun unit tests in guard.test.ts first — don't loop through ad-hoc bash pipes that get blocked by the guard itself
type: feedback
updated: 2026-05-20
---

When testing or expanding anakmagang guards, write tests in `apps/anakmagang/src/tests/guard.test.ts` FIRST, then iterate on the implementation until tests pass.

**Why:** During the command-substitute guard work, the coordinator repeatedly ran ad-hoc bash pipe tests (`echo '{"tool_name":"Bash",...}' | ./anakmagang hook eval`) which were: (1) blocked by the guard itself (circular — the guard sees "npm" in the outer command), (2) not saved anywhere for regression, (3) slow to iterate on. The unit tests via `bun test` run inside the process and bypass the hook entirely.

**How to apply:** When delegating guard work to a worker, include the test cases in the delegation prompt and instruct the worker to add them to `guard.test.ts` as the FIRST step. Use parameterized tests (`for (const [label, cmd] of cases)`) for large test matrices. Never test guards via bash pipes from the coordinator shell.

### Test Isolation (2026-05-20)

Guard test files MUST use isolated temp directories for `outDir`, not the project's real `.anakmagang/out/`. Without isolation, `cleanupAllTestSessions()` (or similar teardown) deletes real orchestration session data.

**Why:** Session `01KS2RNWTRE3Y6MT0GKTBW8W0Y` was destroyed by guard tests using `EventLog.layer` without a custom `Config`. The `cleanupAllTestSessions` function called `eventLog.listSessions()` + `removeSession()` on the real outDir, wiping all sessions. This caused: (1) empty `.anakmagang/out/`, (2) ghost status line from stale context, (3) `PhaseEngineError: Current phase 'undefined'` on eval.

**How to apply:** When delegating guard test creation, explicitly require: `mkdtempSync` for outDir, `Config` layer injection pointing to temp dir, and verify real sessions survive test runs. Reference `EventLog.test.ts` and `Bridge.test.ts` as isolation patterns.
