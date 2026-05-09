---
name: Session storage restructure design
description: Mapping from current SEGA machine (State/Events/Guards/Actions) to new append-only manifest.yaml + logs.yaml structure
type: project
updated: 2026-05-06
---

## Proposed Directory Structure

```
.anakmagang/out/
  {anakmagang_sid}/
    manifest.yaml           ← low traffic: task, phases, observations, reflections
    logs.yaml               ← high traffic: iterations per agent+task
    claude/
      {claude_sid}.json     ← statusLine snapshot, existence = bridge
  references/
```

## File Split

| File | Traffic | Event types | Access pattern |
|---|---|---|---|
| manifest.yaml | Low | task_start, phase_advance, observation | Append on human-driven actions, read for state derivation |
| logs.yaml | High | iteration | Append on every tool call, read+count by iteration-limit guard |

## Event Types (4 total)

| Event type | File | Produced by | Consumed by |
|---|---|---|---|
| task_start | manifest.yaml | anakmagang start | phase engine, guards, statusline (derives: current_task, task_size, active) |
| phase_advance | manifest.yaml | anakmagang next | phase engine, guards, statusline, status cmd (derives: current_phase, completed_phases, reflections) |
| observation | manifest.yaml | anakmagang observe | status cmd (display only) |
| iteration | logs.yaml | iteration-limit guard | iteration-limit guard (count by agent+task) |

## State Derivation (from manifest.yaml)

- **current_task**: last task_start entry
- **current_phase**: last phase_advance entry
- **task_size**: task_start.size
- **completed_phases**: all phase_advance entries
- **reflections**: phase_advance.reflection fields
- **active session**: task_start without matching phase_advance to completion

## Eliminated (dead/redundant state)

- active file — derived from manifest
- bridge/ dir — replaced by claude/{sid}.json existence
- hooks/{event}/ dir — collapsed into claude/{sid}.json
- Root manifest.yaml — was empty sessions: []
- Root feedback/, scratchpad/ — empty dirs
- dirty_files / modified_files — write-only, never consumed
- blockers, active_tasks, session_context — defined but never read
- findings, decisions (manifest slot) — never read, covered by observation
- scratchpad — redundant with observation (text) and iteration (counting)
- dirty-bit-tracking guard — no consumer
- bridge-creator guard — replaced by claude/{sid}.json

## Guards After Restructure

| Guard | Reads from | Changed? |
|---|---|---|
| agent-first | hook input only | No |
| output-location | hook input only | No |
| block-nix-build | hook input only | No |
| compaction-gate | claude/{sid}.json | New location |
| iteration-limit | logs.yaml | New source |
| auto-nix-eval | hook input only | No |
| inject-reminders | manifest.yaml + memories | New source |
| agent-stop-guard | hook input only | No |
| session-stop-guard | manifest.yaml | New source (derive from log) |
| context-cache | claude/{sid}.json + manifest.yaml | New resolution (scan for claude_sid) |
