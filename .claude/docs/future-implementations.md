---
name: Future Implementation Designs
description: Design specifications for deferred Praetorian compliance items — MCP Wrappers and Supply Chain Audit Tooling
type: reference
created: 2026-04-20
---

# Future Implementation Designs

Deferred items from the Praetorian Deterministic AI Orchestration compliance audit. These require more design work and are captured here for future sessions.

---

## 1. MCP Wrapper Pattern

### Problem
Raw MCP server calls lack type validation, have no JIT loading, and don't integrate with the hook system. The Praetorian architecture recommends TypeScript wrappers with Zod schemas around MCP servers.

### Current State
- `settings.local.json` references Serena MCP tools directly
- No wrapper layer exists
- No Zod validation on MCP inputs/outputs
- No JIT loading — tools are always available

### Design

#### Architecture
```
Coordinator
  └─ MCP Wrapper (TypeScript)
       ├─ Zod Schema Validation (input)
       ├─ MCP Server Call (Serena, etc.)
       ├─ Zod Schema Validation (output)
       └─ Hook Integration (PostToolUse logging)
```

#### Components

1. **Wrapper Registry** (`mcp-wrappers/registry.ts`)
   - Maps tool names to wrapper modules
   - Supports JIT loading (require on first use)
   - Provides `listTools()` and `callTool(name, args)` interface

2. **Schema Definitions** (`mcp-wrappers/schemas/`)
   - One file per MCP server
   - Zod schemas for all inputs and outputs
   - Generated from MCP server introspection where possible

3. **Serena Wrapper** (`mcp-wrappers/serena.ts`)
   - Wraps all Serena LSP operations
   - Input validation: file paths, symbol names, ranges
   - Output validation: ensure structured responses
   - Error normalization: consistent error format

4. **Hook Integration**
   - PostToolUse hook for MCP calls logs usage
   - PreToolUse hook validates MCP args against schema
   - Failed validation blocks the call with descriptive error

#### Implementation Steps
1. Set up TypeScript/Bun project in `.claude/mcp-wrappers/`
2. Install zod dependency
3. Introspect existing MCP servers for tool schemas
4. Generate Zod schemas from introspection
5. Write wrapper for each MCP server (Serena first)
6. Update `settings.json` to route MCP calls through wrappers
7. Add PreToolUse hook for MCP validation
8. Test with common Serena operations

#### Estimated Scope
- 5-8 new TypeScript files
- 1 new hook script
- Modifications to settings.json
- MEDIUM task size

#### Dependencies
- Bun or Node.js runtime
- Zod package
- Active MCP server for testing

---

## 2. Supply Chain Audit Tooling

### Problem
Agent definitions and skill files are trusted implicitly. The Praetorian architecture recommends formal audit tooling: Agent Manager (9-phase audit) and Skill Manager (28-phase audit) CLIs that validate these files before they're used.

### Current State
- Agent definitions in `.claude/agents/` — no validation beyond manual review
- Skill files in `.claude/skills/` and `.claude/skill-library/` — no validation
- No audit trail for agent/skill changes
- No compliance checking against ARCHITECTURE.md

### Design

#### Agent Manager CLI

A shell script or Nix-wrapped tool that audits agent definition files.

**9-Phase Audit:**

| Phase | Check | Description |
|-------|-------|-------------|
| 1 | Frontmatter | Valid YAML frontmatter with required fields (name, description, color) |
| 2 | Tool Boundary | Tools listed match the Tool Restriction Boundary in CLAUDE.md |
| 3 | Delegation | Agent does not reference Agent tool (workers can't delegate) |
| 4 | Verification | Agent includes verification commands section |
| 5 | Completion Promises | Agent defines completion promise strings |
| 6 | Skill References | Referenced skills exist in skills/ or skill-library/ |
| 7 | Size Check | Agent definition is <150 lines (Thin Agent Pattern) |
| 8 | Architecture Alignment | Domain routing matches ARCHITECTURE.md table |
| 9 | Output Format | Agent defines structured output format |

**CLI Interface:**
```bash
./scripts/agent-manager audit
./scripts/agent-manager audit nix-coder
./scripts/agent-manager audit --format json
```

#### Skill Manager CLI

A shell script that audits skill files.

**28-Phase Audit** (grouped):

| Group | Phases | Checks |
|-------|--------|--------|
| Structure (1-5) | Frontmatter, file size, sections, naming, location |
| Content (6-12) | Purpose clarity, actionability, examples, edge cases, constraints, anti-patterns, references |
| Integration (13-18) | Gateway routing, agent compatibility, skill dependencies, tool requirements, verification steps, output format |
| Quality (19-24) | Redundancy check, consistency with other skills, version alignment, deprecation markers, test coverage, documentation |
| Security (25-28) | Secret handling, path safety, command safety, permission scope |

**CLI Interface:**
```bash
./scripts/skill-manager audit
./scripts/skill-manager audit nix/module/SKILL.md
./scripts/skill-manager audit --library
./scripts/skill-manager audit --format json --verbose
```

#### Shared Components

1. **Audit Reporter** (`scripts/lib/audit-report.sh`)
   - Consistent output format (pass/warn/fail per check)
   - JSON and human-readable output modes
   - Exit codes: 0 (all pass), 1 (warnings), 2 (failures)

2. **Architecture Parser** (`scripts/lib/arch-parser.sh`)
   - Parses ARCHITECTURE.md for domain-to-worker routing table
   - Extracts verification commands
   - Used by both Agent Manager and Skill Manager

3. **Pre-commit Integration**
   - Add audit checks to `.pre-commit-config.yaml`
   - Runs on changed agent/skill files
   - Blocks commit on audit failures

#### Implementation Steps
1. Create `scripts/` directory structure
2. Implement audit-report.sh shared library
3. Implement arch-parser.sh shared library
4. Implement agent-manager with 9 audit phases
5. Implement skill-manager with 28 audit phases
6. Add shell tests for both tools
7. Integrate with pre-commit hooks
8. Update CLAUDE.md to reference the audit tools
9. Run initial audit on all existing agents and skills

#### Estimated Scope
- 6-10 new shell scripts
- Modifications to pre-commit config
- LARGE task size (recommend dedicated session)

#### Dependencies
- shellcheck (for script validation)
- jq (for JSON output)
- yq (for YAML parsing of frontmatter)

---

## 3. Fractal + Graph Memory System

### Problem
The 16-phase orchestration protocol generates knowledge (reflections, observations, patterns) at every phase transition. Current storage is flat files in `.claude/memories/` with O(n) retrieval and no structural relationships. Cross-session pattern recognition requires scanning all feedback files linearly.

### Current State
- `.claude/memories/` exists but is empty (zero files)
- Feedback pipeline writes to `.data/feedback/` (ephemeral, gitignored)
- Phase 16 manually extracts learnings — no automation
- No cross-session pattern aggregation
- Full design spec: `.claude/docs/fractal-graph-memory.md`

### Design
Three-version evolution path. Each version is independently complete. Advancement requires evidence that the current version is insufficient.

#### V0: Flat Files (Implement Now)
- Use existing CLAUDE.md memory spec as-is
- One file per topic, YAML frontmatter, grep/glob retrieval
- **Scope**: 0 new files to create (spec already exists)
- **Task size**: TRIVIAL — just start using it

#### V1: Fractal Hierarchy + DAG (When V0 Fails at 15+ Files)
- Add obs/fin/lrn/pri/ subdirectories
- Add `derived_from` edges in frontmatter
- Add `scale` and `state` fields
- **Scope**: Update CLAUDE.md memory section, create dirs, migrate existing files
- **Task size**: SMALL

#### V2: Full Graph (When V1 Fails)
- Add `relates_to`, `supports`, `violates` edge types
- Add `_index.yaml` derived cache
- Add `content_hash` staleness detection
- **Scope**: Update CLAUDE.md, create index tooling, wire into orchestration phases
- **Task size**: MEDIUM

### Implementation Steps (V0 Only)
1. Start creating memory files following existing CLAUDE.md spec during normal sessions
2. At Phase 16, extract reusable learnings from feedback → memories
3. Track retrieval quality informally — note when grep fails to find relevant memory
4. After 15+ files with retrieval issues → design V1 implementation session

### Dependencies
- None for V0 (existing spec)
- V1 depends on V0 usage data
- V2 depends on V1 usage data

---

## Priority Order

1. **Fractal + Graph Memory V0** — Highest priority. Zero-cost to start (existing spec), enables learning accumulation that all other tools depend on.
2. **Supply Chain Audit Tooling** — High priority. Validates the agents and skills that everything else depends on.
3. **MCP Wrappers** — Lower priority. Only relevant when actively using MCP servers (Serena).

## Session Planning

Each item should be a dedicated session:
- Fractal Memory V0: TRIVIAL — start using existing spec in normal sessions (no dedicated session needed)
- Fractal Memory V1: SMALL task, estimate 1 session (triggered when V0 shows retrieval issues)
- Fractal Memory V2: MEDIUM task, estimate 1 session (triggered when V1 proves insufficient)
- Supply Chain: LARGE task, estimate 1 full session
- MCP Wrappers: MEDIUM task, estimate 1 session (includes TypeScript setup)
