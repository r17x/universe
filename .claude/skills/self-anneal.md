---
name: self-anneal
description: Meta-process that analyzes feedback files for recurring failures and proposes patches to skills/hooks
---

# Self-Annealing Protocol

When invoked (typically at session end or after recurring failures), this skill analyzes past feedback to identify patterns and propose improvements to the agentic workflow itself.

## Trigger Conditions

Run self-annealing when:
- A failure pattern appears in 3+ feedback files
- A low-confidence reflection recurs across sessions
- A hook blocks the same valid action repeatedly
- An agent consistently produces incorrect output for a task type

## Process

### Step 1: Scan Feedback
Read all files in `<repo-root>/.data/feedback/` and `.claude/memories/`.

Look for:
- `observations.tool_failures` — recurring tool errors
- `observations.wrong_approaches` — repeated failed strategies
- `observations.delegation_issues` — agent miscommunication patterns
- `observations.verification_failures` — systematic check failures
- `reflections` with `confidence: low` — uncertainty patterns

### Step 2: Classify Patterns

| Pattern Type | Example | Fix Target |
|-------------|---------|------------|
| Hook too aggressive | Valid action blocked 3+ times | Hook script (relax condition) |
| Hook too permissive | Bad action allowed repeatedly | Hook script (add check) |
| Skill gap | Agent lacks knowledge for task type | Skill library (add/update skill) |
| Agent scope mismatch | Wrong agent gets wrong tasks | ARCHITECTURE.md routing table |
| Verification gap | Bugs pass checks | verify-*.md (add check) |
| Protocol overhead | Unnecessary phases for task type | orchestrate.md (adjust skip rules) |

### Step 3: Propose Patches

For each identified pattern:
1. Describe the problem (with evidence from feedback)
2. Identify the target file to patch
3. Write the specific change needed
4. Assess risk: will this fix break other workflows?

### Step 4: Apply (with coordinator approval)

- Patches to hooks/skills require coordinator review
- Create a scratchpad entry documenting: what was changed, why, what feedback triggered it
- After applying, run verification to ensure no regressions

## Output Format

```
## Self-Annealing Report

### Patterns Identified
1. [pattern description] — seen in [N] sessions
   - Evidence: [feedback file references]
   - Impact: [what goes wrong]

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
