Read and follow the 16-phase orchestration protocol defined in `.claude/skills/orchestrate.md`.

**Critical path rule:** All `.data/` paths MUST be resolved as absolute paths from the git repo root (the directory containing `flake.nix`). Never use relative paths for `.data/` — agents may have a different working directory.

**Mandatory steps — do NOT skip any of these:**

1. Read `<repo-root>/.data/manifest.yaml` for current state (or initialize if empty/template)
2. Classify the current task as TRIVIAL / SMALL / MEDIUM / LARGE
3. **Write the manifest immediately** after classification with task description, size, branch, and phase status
4. Select the phase set based on skipping rules
5. Execute phases in order — **update manifest `current_phase` at each transition**
6. Route to the appropriate gateway command (`/gateway-nix`) during phases 3 and 8
7. **After implementation (phase 8)**: you MUST continue to verification phases (9-16). Do not stop after the worker agent returns.
8. Run verification commands yourself (coordinator verifies, not the worker)
9. At phase 16 (Completion): clear the manifest task and summarize

Start now with Phase 1 (Setup).
