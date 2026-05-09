# 16-Phase Orchestration Protocol

## When to use

Every non-trivial task. This is the master workflow that governs how work moves from request to completion in the R17{x} Universe configuration.

## State Interface

All state operations go through `anakmagang` CLI:
- **Read**: `anakmagang state` (coordinator runs directly)
- **Machine events** (coordinator runs directly):
  - `anakmagang start "<task>"` → creates session at phase 1/setup, returns exit question
  - `anakmagang next "<answer>" --session <id> [--size <SIZE>]` → records reflection, advances to next phase (or COMPLETE). `--size` required when completing setup.
  - `anakmagang observe "<text>" --session <id>` → records observation without advancing phase
- **Internal writes**: `anakmagang update <KEY> <VALUE> --session <id>` — used by guards, hooks, and scratchpad (delegated to workers)

## Phase Table

| # | Phase | Purpose |
|---|-------|---------|
| 1 | Setup | Run `anakmagang state`, load context, identify branch |
| 2 | Triage | Classify task type and size |
| 3 | Discovery | Explore codebase: find relevant files, modules, patterns |
| 4 | Skill Discovery | Load relevant Tier 2 skills from `.claude/skill-library/` |
| 5 | Complexity | Estimate scope, identify risks and unknowns |
| 6 | Brainstorming | Generate 2-3 approach options, pick best |
| 7 | Architecture | Design module structure, option interfaces, data flow |
| 8 | Implementation | Write the code (delegate to domain worker per ARCHITECTURE.md) |
| 9 | Design Verification | Check architecture decisions were followed |
| 10 | Domain Compliance | Verify CLAUDE.md rules (nixfmt, deadnix, module patterns) |
| 11 | Code Quality | Review for idiomatic Nix, proper lib usage, no anti-patterns |
| 12 | Test Planning | Identify what to verify: eval checks, config assertions |
| 13 | Testing | Run nix eval, nix flake check, format checks |
| 14 | Coverage Verification | Ensure all modified modules are verified |
| 15 | Test Quality | Review verification quality: are assertions meaningful? |
| 16 | Completion | Final verification, update state, summarize |

## Phase Skipping Rules

### TRIVIAL (single-line fix, typo, option tweak)
- Run phases: **1, 8, 16 only**

### SMALL (<100 lines, single module, well-understood)
- Skip phases: **5, 6, 7, 9, 11**
- Run: 1, 2, 3, 4, 8, 10, 12, 13, 14, 15, 16

### MEDIUM (multi-file, multi-module)
- Skip phases: **5 only**
- Run all others

### LARGE (new subsystem, cross-platform, architectural)
- Run **all 16 phases**

## Steps

1. **Load state** — Run `anakmagang state` to check for in-progress work.

2. **Classify the task** — Determine size based on:
   - Number of files affected
   - Number of module types (darwin, home, nixos, cross)
   - Whether new patterns or modules are introduced

3. **Start the machine** — Run `anakmagang start "<task>"`. The machine creates a session at phase 1/setup and returns the exit question.

4. **Complete setup** — After doing Setup work (read ARCHITECTURE.md, memories, feedback), classify the task size and run `anakmagang next "<reflection>" --session $SID --size <SIZE>` to complete setup. The machine uses the size to compute active phases.

5. **Execute remaining phases** — For each active phase:
   - Do the work for the current phase
   - Answer the exit question: `anakmagang next "<answer>" --session $SID` — the machine records the reflection and advances

6. **Route to gateway** — During Discovery (3) and Implementation (8):
   - Nix files → run `/gateway-nix` (delegates to domain worker per ARCHITECTURE.md)
   - Non-Nix files (docs, scripts, configs) → handle directly

7. **Verification** — During phases 9-15:
   - Use `verify-nix.md` for Nix-specific checks
   - Use `verify-complete.md` for full verification

## State Management

State is managed by the `anakmagang` machine. The coordinator drives transitions via machine events:

```bash
anakmagang start "fix iteration-limit"                           # start at phase 1/setup
anakmagang next "no prior feedback" --session $SID --size SMALL  # complete setup with size
anakmagang next "no assumptions" --session $SID                  # answer + advance
anakmagang observe "discovered X" --session $SID                 # record without advancing
anakmagang next "searched broadly" --session $SID                # answer + advance
```

For scratchpad notes, delegate a worker to run:
```bash
anakmagang update findings "discovered X" --session $SID
anakmagang update decisions "chose Y because Z" --session $SID
```

### Compaction recovery

On session resume (phase 1 — Setup):
1. Run `anakmagang state` to get current phase and completed phases
2. Check for blockers or dirty files
3. Resume from recorded current_phase

## Compaction Gates

**Block execution at >85% context before these phases:**
- Phase 3 (Discovery) — heavy reading ahead
- Phase 8 (Implementation) — heavy writing ahead
- Phase 13 (Testing) — heavy verification ahead

When hitting a gate:
1. Run `anakmagang observe "compaction gate hit at phase N" --session $SID`
2. List all files modified
3. Summarize key decisions
4. Request user to continue in new context

## Notes

- Always check CLAUDE.md rules during Domain Compliance (phase 10)
- Pre-commit hooks handle formatting — never run formatters manually
- If a phase produces no actionable output, note "N/A" and move on
- **User interaction**: Use `AskUserQuestion` tool, never output questions as plain text
