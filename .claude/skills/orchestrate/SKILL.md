# 16-Phase Orchestration Protocol

## When to use

Every non-trivial task. This is the master workflow that governs how work moves from request to completion in the R17{x} Universe configuration.

## State Interface

All state operations go through `anakmagang` CLI:
- **Read**: `anakmagang state` (coordinator runs directly)
- **Machine events** (coordinator runs directly):
  - `anakmagang start "<task>"` → creates session at phase 1/setup, returns exit question
  - `anakmagang eval "<answer>" --session <id> [--size <SIZE>]` → evaluates transition (machine computes direction). `--size` required when completing setup.
  - `anakmagang eval "<text>" --session <id> --observe` → records observation without advancing phase
- **Internal writes**: `anakmagang update <KEY> <VALUE> --session <id>` — used by guards, hooks, and scratchpad (delegated to workers)

## Orchestration Phases

| # | Phase | Exit Question |
|---|---|---|
| 1 | Setup | What assumptions am I carrying? What did past feedback tell me? |
| 2 | Triage | Am I solving the right problem? Does my size reflect behavioral impact, not just code volume? Could a 1-line change here break contracts, alter defaults, or shift observable behavior — making it MEDIUM regardless of diff size? |
| 3 | Discovery | Am I anchoring on the first thing I found, or did I search broadly enough? |
| 4 | Skill Discovery | Do I have the right tools, or am I forcing familiar ones onto this problem? |
| 5 | Complexity Analysis | What am I underestimating? What unknown could derail this? |
| 6 | Brainstorming | Are these genuinely different approaches, or variations of the same idea? |
| 7 | Architecture | Will this design survive edge cases I haven't imagined? Am I overengineering? |
| 8 | Implementation | Did I delegate with enough context? Could the worker misinterpret my intent? |
| 9 | Design Verification | Did the implementation drift from the design? Why? |
| 10 | Domain Compliance | Am I checking rules mechanically, or understanding their intent? |
| 11 | Code Quality | Would I be confident rebuilding the system right now? What makes me hesitate? |
| 12 | Test Planning | Am I testing what matters, or what's easy to test? |
| 13 | Testing | Do these checks prove correctness, or just exercise code paths? |
| 14 | Coverage Analysis | What failure mode isn't covered? What would a real user do that I haven't tested? |
| 15 | Test Quality | Could these checks pass with subtly broken code? Are the assertions meaningful? |
| 16 | Completion | What would I do differently if I started over? What did this session teach me? |

### Size Skip Rules

| Type | Phases Used |
|---|---|
| TRIVIAL | setup, implementation, completion |
| SMALL | setup, triage, discovery, skill_discovery, implementation, domain_compliance, test_planning, testing, coverage, test_quality, completion |
| MEDIUM | setup, triage, discovery, skill_discovery, brainstorming, architecture, implementation, design_verification, domain_compliance, code_quality, test_planning, testing, coverage, test_quality, completion |
| LARGE | all |

## Steps

1. **Load state** — Run `anakmagang state` to check for in-progress work.

2. **Classify the task** — Determine size based on:
   - Number of files affected
   - Number of module types (darwin, home, nixos, cross)
   - Whether new patterns or modules are introduced

3. **Start the machine** — Run `anakmagang start "<task>"`. The machine creates a session at phase 1/setup and returns the exit question.

4. **Complete setup** — After doing Setup work (read memories, past feedback), classify the task size and run `anakmagang eval "<reflection>" --session $SID --size <SIZE>` to complete setup. The machine uses the size to compute active phases.

5. **Execute remaining phases** — For each active phase:
   - Do the work for the current phase
   - Answer the exit question: `anakmagang eval "<answer>" --session $SID` — the machine evaluates the transition

6. **Route to gateway** — During Discovery (3) and Implementation (8):
   - Run `/gateway` to route tasks to the correct domain worker based on file patterns in `.anakmagang/config.yaml` ground.routing
   - The gateway handles domain detection, skill-library loading, and worker delegation
   - For cross-domain tasks, the gateway spawns parallel workers (one per domain)

7. **Verification** — During phases 9-15:
   - Use `verify-nix.md` for Nix-specific checks
   - Use `verify-complete.md` for full verification

## State Management

State is managed by the `anakmagang` machine. The coordinator drives transitions via machine events:

```bash
anakmagang start "fix iteration-limit"                           # start at phase 1/setup
anakmagang eval "no prior feedback" --session $SID --size SMALL  # complete setup with size
anakmagang eval "no assumptions" --session $SID                  # evaluate transition
anakmagang eval "discovered X" --session $SID --observe                 # record without advancing
anakmagang eval "searched broadly" --session $SID                # evaluate transition
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
1. Run `anakmagang eval "compaction gate hit at phase N" --session $SID --observe`
2. List all files modified
3. Summarize key decisions
4. Request user to continue in new context

## Notes

- Always check CLAUDE.md rules during Domain Compliance (phase 10)
- Pre-commit hooks handle formatting — never run formatters manually
- If a phase produces no actionable output, note "N/A" and move on
- **User interaction**: Use `AskUserQuestion` tool, never output questions as plain text
