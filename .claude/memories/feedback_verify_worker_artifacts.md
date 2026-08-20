---
name: Verify worker artifacts exist after delegation
description: Workers can report IMPLEMENTATION_COMPLETE without writing files — always check artifacts exist
type: feedback
updated: 2026-05-11
---

Worker completion signals are claims, not proofs. A worker can emit `IMPLEMENTATION_COMPLETE` without having persisted any files.

**Why:** A worker delegated to create `pond-capture.ts` reported completion but the file was never written to disk. Discovered only when attempting to run the script — got "Module not found". The coordinator trusted the signal and moved on.

**How to apply:** After every worker returns a completion signal, the coordinator must verify artifacts exist (glob/read the expected output files) before advancing phase. Treat `IMPLEMENTATION_COMPLETE` as "claims complete" — verify before trusting.
