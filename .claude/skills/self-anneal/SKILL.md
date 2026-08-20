---
name: self-anneal
description: Meta-process that analyzes session state and memories for recurring failures and proposes patches to skills/hooks
updated: "2026-05-10"
---
# Self-Annealing Protocol

When invoked (typically at session end or after recurring failures), this skill analyzes past feedback to identify patterns and propose improvements to the agentic workflow itself.

## Trigger Conditions

Run self-annealing when:
- A failure pattern appears in 3+ sessions
- A low-confidence reflection recurs across sessions
- A hook blocks the same valid action repeatedly
- An agent consistently produces incorrect output for a task type

## Process

### Step 1: Scan Feedback

Collect session data using the actual CLI commands:

1. Run `anakmagang state` to list all sessions (id, status, task, phase)
2. For each recent session, run `anakmagang state <session-id>` to get:
   - `observations[]` — free-text strings (recorded via `anakmagang eval --observe`)
   - `reflections[{phase, reflection}]` — phase transition reflections (recorded via `anakmagang eval`)
   - `completed_phases[]` — phases the session traversed
   - `current_phase`, `task_size`, `active` — session metadata
3. Run `anakmagang memory status` to check scale distribution across memories
4. Run `anakmagang memory query -q "<pattern>"` to search for recurring themes in `.claude/memories/`

Observations and reflections are free text. Extract patterns by scanning for keywords:

| Category | Scan observations for | Scan reflections for |
|----------|----------------------|---------------------|
| Tool failures | "fail", "error", "blocked", "broke" | "failed", "broken" |
| Wrong approaches | "tried X, failed", "approach:", "wrong" | "assumption", "anchoring", "should have" |
| Delegation issues | "worker", "delegation", "misinterpret", "agent" | "delegate", "context", "misinterpret" |
| Verification failures | "verification", "check failed", "nix eval" | "drift", "regression" |
| Low-confidence areas | — | "low confidence", "uncertain", "not sure", "hesitate", "underestimating" |

### Step 2: Classify Patterns

| Pattern Type | Example | Fix Target |
|-------------|---------|------------|
| Hook too aggressive | Valid action blocked 3+ times | Hook script (relax condition) |
| Hook too permissive | Bad action allowed repeatedly | Hook script (add check) |
| Skill gap | Agent lacks knowledge for task type | Skill library (add/update skill) |
| Agent scope mismatch | Wrong agent gets wrong tasks | ARCHITECTURE.md routing table |
| Verification gap | Bugs pass checks | verify-*.md (add check) |
| Protocol overhead | Unnecessary phases for task type | orchestrate.md (adjust skip rules) |
| Memory stagnation | Too many observations never promoted | Memory scale (promote or prune) |

### Step 3: Propose Patches

For each identified pattern:
1. Describe the problem (with evidence: session IDs, observation text, reflection quotes)
2. Identify the target file to patch
3. Write the specific change needed
4. Assess risk: will this fix break other workflows?

Cross-reference with memory system:
- Run `anakmagang memory query -q "<pattern keywords>"` to check if this pattern was already captured
- If a memory exists at `observation` scale and the pattern recurs 3+ times, propose promotion via `anakmagang memory promote <id>`
- If no memory exists, propose creating one via `anakmagang memory create`

### Step 4: Apply (with coordinator approval)

- Patches to hooks/skills require coordinator review
- Document each change: `anakmagang eval "anneal: <description of what was changed and why>" --session <id> --observe`
- For recurring patterns graduating in confidence: `anakmagang memory promote <id>` (observation→finding→learning→principle)
- Run `anakmagang memory prune` to mark stale memories for archival
- After applying, run verification to ensure no regressions

## Output Format

```
## Self-Annealing Report

### Patterns Identified
1. [pattern description] — seen in [N] sessions
   - Evidence: [session IDs, observation/reflection quotes]
   - Impact: [what goes wrong]

### Memory Actions
1. [promote/create/prune] — [memory name] — [rationale]

### Proposed Patches
1. [target file] — [change description]
   - Risk: low/medium/high
   - Rationale: [why this fixes the pattern]

### Applied Patches
1. [file] — [change summary] ✓/✗

ANNEAL_COMPLETE | ANNEAL_PROPOSALS_ONLY
```

## Constraints

- Never auto-apply patches to CLAUDE.md without coordinator approval
- Never weaken security hooks (output-location, agent-first enforcement)
- Always preserve existing hook behavior for non-problematic cases
- Document every change in `.claude/memories/workflow-learnings.md`
