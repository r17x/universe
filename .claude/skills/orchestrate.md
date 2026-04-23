# 16-Phase Orchestration Protocol

## When to use

Every non-trivial task. This is the master workflow that governs how work moves from request to completion in the R17{x} Universe configuration.

## Critical: File Paths

**All `.data/` paths are relative to the git repository root.** When using Read/Write/Edit tools, always resolve to absolute paths:
- Manifest: `<repo-root>/.data/manifest.yaml`
- Feedback: `<repo-root>/.data/feedback/<SID>.yaml`
- Context cache: `<repo-root>/.data/context-cache/`

The repo root is the directory containing `flake.nix`. When in doubt, use `git rev-parse --show-toplevel` to find it. **Never** create `.data/` in a subdirectory or relative to the current working directory.

## Phase Table

| # | Phase | Purpose |
|---|-------|---------|
| 1 | Setup | Read manifest, load context, identify branch |
| 2 | Triage | Classify task type and size |
| 3 | Discovery | Explore codebase: find relevant files, modules, patterns |
| 4 | Skill Discovery | Load relevant Tier 2 skills from `.claude/skill-library/` |
| 5 | Complexity | Estimate scope, identify risks and unknowns |
| 6 | Brainstorming | Generate 2-3 approach options, pick best |
| 7 | Architecture | Design module structure, option interfaces, data flow |
| 8 | Implementation | Write the Nix code (delegate to nix-coder) |
| 9 | Design Verification | Check architecture decisions were followed |
| 10 | Domain Compliance | Verify CLAUDE.md rules (nixfmt, deadnix, module patterns) |
| 11 | Code Quality | Review for idiomatic Nix, proper lib usage, no anti-patterns |
| 12 | Test Planning | Identify what to verify: eval checks, config assertions |
| 13 | Testing | Run nix eval, nix flake check, format checks |
| 14 | Coverage Verification | Ensure all modified modules are verified |
| 15 | Test Quality | Review verification quality: are assertions meaningful? |
| 16 | Completion | Final verification, update manifest, summarize |

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

1. **Read manifest** — Read `<repo-root>/.data/manifest.yaml` using the Read tool with the absolute path. If the file doesn't exist, initialize it with the schema below.

2. **Classify the task** — Determine size based on:
   - Number of files affected
   - Number of module types (darwin, home, nixos, cross)
   - Whether new patterns or modules are introduced

3. **Select phase set** — Apply skipping rules

4. **Execute phases in order** — For each active phase:
   - State which phase you are entering
   - Complete the phase fully before moving on
   - **Write manifest after EVERY phase transition**

5. **Route to gateway** — During Discovery (3) and Implementation (8):
   - Nix files → run `/gateway-nix` (delegates to `nix-coder`)
   - Non-Nix files (docs, scripts, configs) → handle directly

6. **Verification** — During phases 9-15:
   - Use `verify-nix.md` for Nix-specific checks
   - Use `verify-complete.md` for full verification

## Manifest Management

The manifest tracks task state. Located at `<repo-root>/.data/manifest.yaml`.

### Manifest schema

```yaml
version: 1
sessions:
  - session_id: "<session-id>"
    current_task: none | "<description>"
    current_phase: none | <phase-number>
    completed_phases: []
    findings: []
    decisions: []
    dirty_files: []
    blockers: []
    active_tasks: []
    session_context:
      branch: <branch-name>
      last_commits: []
      status: <working tree status>
```

### Compaction recovery

On session resume (phase 1 — Setup), if manifest has state:
1. Read current_phase and completed_phases from the last session entry
2. Check for dirty_files that may need attention
3. Resume from recorded current_phase
4. Check session_context for branch and status

## Compaction Gates

**Block execution at >85% context before these phases:**
- Phase 3 (Discovery) — heavy reading ahead
- Phase 8 (Implementation) — heavy writing ahead
- Phase 13 (Testing) — heavy verification ahead

When hitting a gate:
1. Write current state to `<repo-root>/.data/manifest.yaml`
2. List all files modified
3. Summarize key decisions
4. Request user to continue in new context

## Notes

- Always check CLAUDE.md rules during Domain Compliance (phase 10)
- Pre-commit hooks handle formatting — never run formatters manually
- If a phase produces no actionable output, note "N/A" and move on
- **User interaction**: Use `AskUserQuestion` tool, never output questions as plain text
