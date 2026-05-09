---
name: anakmagang machine interface
description: State machine owns transitions via start/next/observe — implemented and verified
type: project
updated: 2026-05-05
---

The machine owns phase transitions. Callers send events, not field writes.

**Why:** A real state machine encapsulates transition logic. The caller should not need to know about internal fields, phase ordering, or skip rules.

**Implemented interface:**
- `anakmagang start "<task>"` → creates session at phase 1/setup, returns exit question
- `anakmagang next "<answer>" [--size <SIZE>] [--session <id>]` → records reflection, advances to next phase (or COMPLETE). `--size` required when completing setup.
- `anakmagang observe "<text>" [--session <id>]` → records observation without advancing phase
- `anakmagang state [<id>]` → read current state (unchanged)
- `anakmagang update <KEY> <VALUE>` → internal only (guards, hooks, scratchpad)

**Session identity:** Mutations (`next`/`observe`) require session context — either `CLAUDE_SESSION_ID` env (bridge lookup) or explicit `--session` flag. No fallback to `active` file. Bare shell calls are blocked.

**How to apply:** The agent classifies via `/orchestrate`, then starts the machine. The machine handles phase graph, skip rules, reflections, and completed_phases internally. The `update <KEY> <VALUE>` form is internal-only, used by guards and hooks.
