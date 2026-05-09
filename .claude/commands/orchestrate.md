Read and follow the 16-phase orchestration protocol defined in `.claude/skills/orchestrate.md`.

**State interface:** The `anakmagang` machine owns phase transitions. The agent classifies, the machine tracks.

**Mandatory steps — do NOT skip any of these:**

1. Run `anakmagang state` for current session state
2. Run `anakmagang start "<task>"` to create a session at phase 1/setup
3. Do Setup work: read `ARCHITECTURE.md`, memories, past feedback
4. Classify the current task as TRIVIAL / SMALL / MEDIUM / LARGE
5. Run `anakmagang next "<reflection>" --size <SIZE>` to complete setup — the machine computes active phases
6. Execute remaining phases — run `anakmagang next "<reflection>"` to advance each phase
7. Route to the appropriate domain gateway during phases 3 and 8 (e.g., `/gateway-nix` for Nix files)
8. **After implementation (phase 8)**: you MUST continue to verification phases (9-16). Do not stop after the worker agent returns.
9. Run verification commands yourself (coordinator verifies, not the worker)
10. Record issues with `anakmagang observe "<issue>"` at any time
11. At final phase, run `anakmagang next "<final reflection>"` — the machine completes the session

Start now with Phase 1 (Setup).
