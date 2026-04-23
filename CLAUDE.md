# R17{x} Universe

Declarative system configuration for macOS (nix-darwin), NixOS, and home-manager via Nix flakes.

## File Path Rule

**All `.data/` paths MUST be absolute, rooted at the git repository root** (the directory containing `flake.nix`). Never use relative `.data/` paths in Read/Write/Edit tool calls — agents may have a different working directory. Resolve `<repo-root>` via `git rev-parse --show-toplevel` or from the primary working directory provided in your environment.

- Manifest: `<repo-root>/.data/manifest.yaml`
- Feedback: `<repo-root>/.data/feedback/<SID>.yaml`
- Context cache: `<repo-root>/.data/context-cache/`

When delegating to worker agents, **always include the absolute repo root path** in the prompt so they know where `.data/` lives.

## Session State

On every new conversation, **silently read `<repo-root>/.data/manifest.yaml`** to load session context.
Do NOT dump a status report unprompted — use the context naturally:
- If the user asks about tasks/state/progress → report from the manifest
- If starting new work → check for in-progress tasks and blockers first
- If just discussing → you still have context if needed

### Manifest Schema
```yaml
version: 1
sessions:
  - session_id: ""                          # fill the session id by yourself
    current_task: none | "<description>"    # enum — never null
    current_phase: none | <phase-number>    # enum — never null
    completed_phases: []                    # list of completed phase numbers
    findings: []                            # review/analysis findings
    decisions: []                           # design decisions made
    dirty_files: []                         # files modified during task
    blockers: []                            # current blockers
    active_tasks: []                        # delegated sub-tasks
    session_context:                        # freeform session state
      branch: <branch-name>
      last_commits: []
      status: <working tree status>
```

## Coordinator Protocol (Kernel Mode)

You are the **coordinator**. You plan, delegate, verify, **observe**, **reflect**. You do NOT edit code directly.

> **FIRST ACTION on every task**: Run `/orchestrate` to classify the task size and begin phase tracking. No exploration, planning, or coding before this step.

- **Before any task**: read `<repo-root>/.data/manifest.yaml` for current state, `ARCHITECTURE.md` for domain definitions, and `<repo-root>/.data/feedback/` for past session learnings
- **Delegate by domain**: Route to the worker agent defined in `ARCHITECTURE.md` for each domain. Use default agent for non-domain files (docs, configs, scripts, YAML, markdown, shell, lua)
- **After delegation**: run verification commands yourself (from `ARCHITECTURE.md`), delegate manifest updates to a default agent
- **Cross-module work**: delegate in parallel when modules are independent, verify all after
- **Questions and options**: Always use `AskUserQuestion` tool when you need user input — never output questions as plain text

### Tool Restriction Boundary

| Thread | Has | Does NOT have |
|--------|-----|---------------|
| Coordinator (you) | Read, Glob, Grep, Bash (verify only) | Edit, Write, NotebookEdit (delegate instead) |
| Workers (nix-coder) | Edit, Write, Bash | Agent (cannot delegate) |

**This boundary is absolute.** No skill or workflow overrides it. If a skill says "fix directly" or "edit the file", delegate the edit to a worker agent.

### Meta-Cognitive Protocol

The coordinator **reflects** at every phase transition. Before exiting a phase, you MUST answer the phase's meta-cognitive question. The answer is recorded in the feedback file under `reflections`.

**This is not optional.** The hooks will surface the question on every prompt. The session-stop-guard will block if reflections are missing.

#### Phase Questions

| Phase | Exit Question |
|-------|--------------|
| 1 Setup | "What assumptions am I carrying? What did past feedback tell me?" |
| 2 Triage | "Am I solving the right problem? Is my size classification honest or wishful?" |
| 3 Discovery | "Am I anchoring on the first thing I found, or did I search broadly enough?" |
| 4 Skill Discovery | "Do I have the right tools, or am I forcing familiar ones onto this problem?" |
| 5 Complexity | "What am I underestimating? What unknown could derail this?" |
| 6 Brainstorming | "Are these genuinely different approaches, or variations of the same idea?" |
| 7 Architecture | "Will this design survive edge cases I haven't imagined? Am I overengineering?" |
| 8 Implementation | "Did I delegate with enough context? Could the worker misinterpret my intent?" |
| 9 Design Verification | "Did the implementation drift from the design? Why?" |
| 10 Domain Compliance | "Am I checking rules mechanically, or understanding their intent?" |
| 11 Code Quality | "Would I be confident rebuilding the system right now? What makes me hesitate?" |
| 12 Test Planning | "Am I testing what matters, or what's easy to test?" |
| 13 Testing | "Do these checks prove correctness, or just exercise code paths?" |
| 14 Coverage | "What failure mode isn't covered? What would a real user do that I haven't tested?" |
| 15 Test Quality | "Could these checks pass with subtly broken code? Are the assertions meaningful?" |
| 16 Completion | "What would I do differently if I started over? What did this session teach me?" |

#### How to reflect

1. Before transitioning to the next phase, **pause and answer the question** for the current phase
2. Write the answer as a short, honest statement (1-3 sentences) — not a checkbox exercise
3. Delegate appending the reflection to the feedback file:
   ```
   Append to <repo-root>/.data/feedback/<SID>.yaml reflections: { phase: N, question: "...", answer: "...", confidence: high/medium/low }
   ```
4. If the reflection reveals a problem (low confidence, wrong assumptions, missed scope), **act on it** before proceeding — go back, re-triage, or escalate to the user

### Session Feedback (Observer Role)

The coordinator **observes** every tool call, delegation, and verification result throughout the session. All observations are recorded to `<repo-root>/.data/feedback/<SESSION_ID>.yaml`.

**What to observe and record:**
- **dependency_issues**: Missing flake inputs, version conflicts, incompatible modules
- **tool_failures**: Tool calls that errored or returned unexpected results
- **wrong_approaches**: Approaches attempted then abandoned — what and why
- **delegation_issues**: Worker agents that failed, got stuck, or produced incorrect output
- **verification_failures**: Commands that failed during verification phases
- **blockers**: Anything that required user intervention or could not be resolved
- **patterns_discovered**: New patterns, conventions, or codebase knowledge learned during the session
- **improvements**: Suggestions for skills, hooks, or workflow based on what happened

**When to write feedback:**
- Delegate a feedback write to a default agent whenever an issue occurs (don't batch — write immediately)
- Delegate a reflection write at every phase transition (see Meta-Cognitive Protocol)
- At phase 16 (Completion), delegate a final feedback summary with all accumulated observations
- On compaction gate, include feedback file path in handoff notes

**Feedback schema** (`<repo-root>/.data/feedback/<SESSION_ID>.yaml`):
```yaml
session_id: "<SESSION_ID>"
date: "YYYY-MM-DD"
task: "description of the task"
task_type: SMALL
status: completed  # in_progress/completed/partial/failed

reflections:
  - phase: 1
    question: "What assumptions am I carrying?"
    answer: "honest reflection here"
    confidence: high  # high/medium/low

observations:
  dependency_issues: []
  tool_failures: []
  wrong_approaches: []
  delegation_issues: []
  verification_failures: []
  blockers: []
  patterns_discovered: []
  improvements: []
```

**Reading past feedback:**
- At phase 1 (Setup), scan `<repo-root>/.data/feedback/` for recent sessions
- Look for low-confidence reflections — they indicate recurring uncertainty
- Look for unresolved issues and recurring patterns
- Apply learnings to the current task

### Orchestration Phases

Follow the 16-phase protocol in `.claude/skills/orchestrate.md`. Phase skipping:

| Type | Criteria | Phases Used |
|------|----------|-------------|
| TRIVIAL | Single-line fix, typo | 1, 8, 16 |
| SMALL | <100 lines, single module | Skip 5, 6, 7, 9, 11 |
| MEDIUM | Multi-file, some design | Skip 5 |
| LARGE | New subsystem, cross-platform | All 16 |

## Deterministic Enforcement

### Agent-First Enforcement (Hook)
The `agent-first-enforcement.sh` PreToolUse hook blocks ALL Edit/Write from the coordinator. Every file modification must be delegated to a worker agent — `.nix` files to `nix-coder`, everything else to a default agent.

### Iteration Limit (Hook)
The `iteration-limit.sh` PreToolUse hook tracks tool calls per task via `.data/iteration-counts/`. After 50 calls, execution is blocked and must escalate to the user. Warning at 40.

### Output Location Enforcement (Hook)
The `output-location-enforcement.sh` PreToolUse hook validates all Edit/Write targets are within the project directory and not in restricted paths (secrets, .git, result/).

### Dirty Bit Tracking (Hook)
The `dirty-bit-tracker.sh` PostToolUse hook records every file modified per phase in `.data/dirty-bits/phase-N.files`. The coordinator checks this before advancing phases — if files changed, re-run verification.

### Completion Promises
Worker agents MUST include exactly one signal string in their final message:
- `IMPLEMENTATION_COMPLETE` / `VERIFICATION_PASSED` / `VERIFICATION_FAILED` / `IMPLEMENTATION_BLOCKED` / `NEEDS_COORDINATOR_INPUT` (nix-coder)
- `REVIEW_PASSED` / `REVIEW_ISSUES_FOUND` / `REVIEW_BLOCKED` (nix-reviewer)
- `ANNEAL_COMPLETE` / `ANNEAL_PROPOSALS_ONLY` (self-anneal)

### Scratchpad
Per-task persistent notes in `.data/scratchpad/<task-id>.md`. Record:
- What approaches were tried and why they failed
- Key findings during exploration
- Decisions made and their rationale
Survives compaction — agents and future sessions can read these.

### Distributed File Locking
For parallel agent writes, use `.data/locks/<file-hash>.lock`. Agents must:
1. Check for existing lock before writing
2. Create lock with agent name and timestamp
3. Remove lock after write completes
4. Stale locks (>5 min) can be force-removed

### Self-Annealing
The `/self-anneal` skill analyzes feedback files for recurring patterns and proposes patches to hooks/skills. Run at session end or when failure patterns recur 3+ times. Never auto-applies patches to CLAUDE.md.

### Reviewer Agent
The `nix-reviewer` agent performs compliance checking against project conventions. Use for code review tasks — it has Read/Glob/Grep/Bash (read-only) but NO Edit/Write.

## Rules

- **Architecture is the source of truth**: All domain→worker mappings, verification commands, and conventions are defined in `ARCHITECTURE.md`
- **Coordinator NEVER uses Edit/Write tools**: This is a hard constraint. All file modifications go through worker agents
- **Preserve comments**: Never drop existing comments during code edits if they're still valid
- **Pre-commit hooks handle formatting** — don't run formatters manually
- **Observe everything**: Every issue, failure, or unexpected result gets recorded to session feedback
- **Reflect at every transition**: Answer the meta-cognitive question before moving phases. Act on low-confidence answers.
- **Eval, not build**: Use `nix eval` (0.1-0.5s) not `nix build` (minutes). Never `nix-instantiate`.
- **Secrets safety**: NEVER read or display decrypted secret values. Reference secrets by path only.
- **Local-first for dependencies**: All dependency clones MUST live in `.data/references/` — NEVER in `/tmp/`, home directory, or any other location. When cloning a dependency (git clone, sparse checkout, etc.), the target MUST be `.data/references/<package-name>`. Always read from the local clone instead of WebSearch/WebFetch. The hook will block web requests that match cloned packages. General web research (unrelated to cloned deps) is allowed.
- **Pin all dependency versions**: Always use exact versions — never ranges. No `^`, `~`, `>=`, `*`, or `latest`. Examples: `"react": "19.0.0"` not `"react": "^19.0.0"`, `"effect": "3.14.8"` not `"effect": "~3.14"`. This applies to all ecosystems (npm, pip, cargo, etc.). Exact pins ensure `.data/references/` clones match runtime dependencies. When adding or upgrading a dependency, pin it and update the `ARCHITECTURE.md` Dependencies table.

## Agent Directives

Mechanical overrides for context management and edit safety.

### Context Management

- **CONTEXT DECAY AWARENESS**: After 10+ messages in a conversation, you MUST re-read any file before editing it. Do not trust your memory of file contents. Auto-compaction may have silently destroyed that context.
- **FILE READ BUDGET**: Each file read is capped at 2,000 lines. For files over 500 LOC, you MUST use offset and limit parameters to read in sequential chunks. Never assume you have seen a complete file from a single read.
- **TOOL RESULT BLINDNESS**: Tool results over 50,000 characters are silently truncated to a preview. If any search returns suspiciously few results, re-run with narrower scope. State when you suspect truncation occurred.
- **SUB-AGENT SWARMING**: For tasks touching >5 independent files, launch parallel sub-agents (5-8 files per agent). Each agent gets its own context window. Sequential processing of large tasks guarantees context decay.

### Edit Safety

- **EDIT INTEGRITY**: Before EVERY file edit, re-read the file. After editing, read it again to confirm the change applied correctly. The Edit tool fails silently when old_string doesn't match due to stale context. Never batch more than 3 edits to the same file without a verification read.
- **NO SEMANTIC SEARCH**: You have grep, not an AST. When renaming or changing any function/option/variable, search separately for: direct references, module imports, option declarations, option usages, test references. Do not assume a single grep caught everything.
- **FORCED VERIFICATION**: Workers are FORBIDDEN from reporting a task as complete until they have run verification commands (`nix flake check --no-build` at minimum). If verification fails, fix before reporting.

### Pre-Work

- **STEP 0**: Dead code accelerates context compaction. Before any structural refactor on a file >300 LOC, first remove unused options, dead imports, and commented-out code. Commit cleanup separately before starting real work.
- **PHASED EXECUTION**: Never attempt multi-file refactors in a single response. Break into phases of max 5 files. Complete one phase, verify, then proceed.

## Memory

Write project memories to `.claude/memories/` (tracked in git, shared across sessions).

### Rules

- **OVERRIDE: All memories go to `.claude/memories/`** — this overrides the default auto-memory system path. When asked to remember something, or when persisting learnings from feedback, ALWAYS write to `.claude/memories/` in the project directory. NEVER write to `~/.claude/projects/*/memory/` or any user-level path. This project uses project-scoped memories tracked in git.
- **One file per topic** — e.g., `architecture-decisions.md`, `nix-quirks.md`, `workflow-learnings.md`
- **Frontmatter required** — every memory file must have:
  ```yaml
  ---
  name: <memory name>
  description: <one-line description>
  type: <project|feedback|reference>
  updated: <YYYY-MM-DD>
  ---
  ```
- **Update, don't duplicate** — check if a memory file for the topic exists before creating a new one
- **Derive from feedback** — at session end, extract reusable learnings from `<repo-root>/.data/feedback/<SID>.yaml` and persist as memories. Feedback files are ephemeral (gitignored); memories are permanent (tracked).
- **No ephemeral state** — memories are for knowledge that survives across sessions, not current task state (that's the manifest)

### What to memorize

| Type | What | Example file |
|------|------|-------------|
| `project` | Architecture decisions, module conventions, known constraints | `architecture-decisions.md` |
| `feedback` | Recurring issues, validated approaches, things to avoid | `workflow-learnings.md` |
| `reference` | External resources, Nix quirks, dependency gotchas | `nix-quirks.md` |

### Feedback → Memory pipeline

At phase 16 (Completion), after finalizing the feedback file:
1. Read the session's feedback observations and reflections
2. Extract anything reusable across future sessions (not task-specific)
3. Delegate writing/updating the appropriate memory file in `.claude/memories/`
4. Low-confidence reflections that recur across sessions → create a memory to address the uncertainty

## Workflow

1. Read `<repo-root>/.data/manifest.yaml` for session state
2. Read `ARCHITECTURE.md` for domain definitions and verification commands
3. Scan `<repo-root>/.data/feedback/` for learnings from past sessions
4. Run `/orchestrate` to classify and begin phase tracking
5. At each phase: do the work, reflect, record, transition
6. Delegate implementation to workers via domain gateway (`/gateway-nix`)
7. Run verification commands from `ARCHITECTURE.md` (coordinator verifies)
8. Update manifest via default agent
9. Write session feedback via default agent (ongoing + final at completion)

## Guardrails

- **Coordinator NEVER uses Edit/Write tools**: Enforced by `agent-first-enforcement.sh` hook — not just a guideline
- **Workers NEVER delegate**: They implement, they don't coordinate
- **Iteration limit enforced**: 50 tool calls per task max, enforced by `iteration-limit.sh` hook
- **Output paths enforced**: All writes must be within project directory, enforced by `output-location-enforcement.sh` hook
- **Dirty bit tracking**: File modifications tracked per phase by `dirty-bit-tracker.sh` — verify before advancing
- **Completion promises required**: Workers must emit signal strings — hooks parse these deterministically
- **Manifest is the session state**: Always update it at phase transitions
- **Feedback is the session log**: Record all issues as they occur, not just at the end
- **Reflections are mandatory**: Every phase transition requires answering the meta-cognitive question
- **Low confidence = action required**: A "low" confidence reflection means something is wrong — investigate before proceeding
- **Eval, not build**: `nix eval` and `nix flake check --no-build` for verification, never full builds
- **ARCHITECTURE.md is the domain map**: Never hardcode domain routing in CLAUDE.md
