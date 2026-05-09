---
name: Anakmagang CLI Analysis Report
description: Principal Thinking analysis — problem decomposition, constraints, failure modes, solution architecture
type: reference
created: 2026-04-24
---

# Anakmagang CLI — Analysis Report

Summary of the 4-phase Principal Thinking analysis with dual-agent review loop.

## Problem Decomposition

```
Deterministic, observable AI orchestration
├─ Knowledge persistence (Memory)
│  ├─ Cross-session pattern recognition
│  ├─ Hierarchical compression (obs→finding→learning→principle)
│  └─ Concurrent-safe persistence (effect-crdts port to Effect 4.x)
├─ Trust in AI-generated code (Audit)
│  ├─ Agent definition validation (9-phase)
│  ├─ Skill file compliance (28-phase)
│  └─ Convention drift detection via ARCHITECTURE.md parsing
└─ Type-safe tool integration (MCP)
   ├─ Schema-validated I/O (Effect Schema at boundaries)
   ├─ Stdio transport safety (kill+respawn, never retry same pipe)
   └─ Server lifecycle management (Scope-managed child processes)
```

### Why This Exists

The R17{x} Universe orchestration harness generates knowledge at every phase transition (reflections, observations, patterns). Current state:
- Agent/skill definitions trusted implicitly — no automated validation
- Knowledge stored flat in feedback files — no cross-session retrieval
- MCP tool responses unvalidated — coordinator trusts raw JSON

**Real problem:** Not tooling — it's knowledge persistence and trust in AI-generated configurations. anakmagang shifts from "trust humans to follow rules" to "tools enforce rules and remember what worked."

### Stakeholder Priority

| Priority | Persona | Primary Need | anakmagang Subsystem |
|----------|---------|-------------|---------------------|
| 1 | R17 (developer) | Quality gate + knowledge base | Audit + Memory |
| 2 | Claude (coordinator) | Persistent context + type-safe tools | Memory + MCP |
| 3 | Worker agents | Real-time compliance feedback | Audit (indirect) |
| 4 | Future contributors | Self-service onboarding | Memory + Audit |

## Constraints

### Hard Constraints

| Category | Constraint |
|----------|-----------|
| Runtime | Bun + TypeScript, Effect 4.x |
| CLI | @effect/cli (Command.make + Options + Args) |
| Platform | @effect/platform-bun (FileSystem, Command, Terminal) |
| Validation | effect/Schema only |
| Structure | Flat (~28 files, 0 dirs), PascalCase = services, lowercase.dot = commands |
| Errors | Co-located (1-2 per service), no centralized errors.ts |
| Memory | Unified schema (full fractal graph), search via fff-c native library (bun:ffi) |
| CRDT | Port effect-crdts to Effect 4.x for SchemaRegistry persistence |
| Protocol | Coordinator never edits, 50-call limit, eval-not-build |
| Versioning | Exact version pins + bun.lockb committed |

### Anti-Constraints (Explicitly Forbidden)

- NO centralized errors/schemas, NO helpers/utils unless truly needed
- NO console.log (Effect.log/Console.info only), NO process.exit
- NO additional edge types beyond derived_from until proven insufficient
- NO HTTP server capabilities, NO bundled MCP schemas
- NO eager global layer provision (lazy per-command for domain services)

## Failure Mode Summary

### Catastrophic Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Stdio corruption (MCP) | HIGH | Kill+respawn on any transport error. Never retry same pipe. Redirect all logs to stderr. |
| Stale memory poisoning | HIGH | session_count + state transitions from day one. Prune command enforces lifecycle. |
| CRDT file corruption | MEDIUM | Atomic writes (temp+rename). Backup on parse failure. Rebuildable from source files. |
| ARCHITECTURE.md parse failure | MEDIUM | Validate parsed output against DomainRoute schema. Fail loudly on zero routes. |

### State Machine Cascade Points

| System | Cascade Point | Impact |
|--------|--------------|--------|
| CLI Lifecycle | PROVIDE_LAYERS root failure | All subsystems fail. Mitigated by lazy per-command provision. |
| MCP Call Flow | Stdio corruption | Connection poisoned forever. Must kill+respawn process. |
| Audit Pipeline | ArchParser failure | Phase 8 fails for all targets. Other phases unaffected. |
| Memory CRUD | Concurrent writes | Atomic temp+rename for file writes. CRDT for schema registry. |
| Session Integration | Manifest corruption | All phase tracking lost. Backup+reinitialize on parse failure. |

## Solution Architecture

### Component Layers

```
Layer 0 (external):     @effect/platform-bun, @effect/cli, effect 4.x, libfff.dylib (bun:ffi)
Layer 1 (shared):       Config, Yaml, Search
Layer 2 (domain):       MemoryStore,
                        ArchParser, AgentAuditor, SkillAuditor,
                        McpClient, SchemaRegistry
Layer 3 (commands):     memory.*, audit.*, mcp.* (13 command files)
Layer 4 (composition):  cli.ts, bin.ts
```

Imports flow strictly downward. No circular dependencies. Verified.

### Layer Provision Strategy

All layers are command-lazy — domain services (Config, Yaml, Search, McpClient, AgentAuditor, MemoryStore) are provided per-command via `Effect.provide` inside handler. No root-eager provision exists. A service failure in MCP doesn't prevent `memory status` from working.

### Implementation Sequence

| Phase | Files | Verification | Risk |
|-------|-------|-------------|------|
| A (Foundation) | Config, Yaml, Search, FFF | Unit tests with Effect TestContext | Low |
| B (Memory core) | MemoryStore, memory.status, memory.ts | Integration: `bun run bin.ts memory status` | Low |
| C (Memory + Audit foundation) | memory.create/query/promote/prune, ArchParser | Integration: create+query round-trip, ArchParser parses ARCHITECTURE.md | Low |
| D (Audit) | AgentAuditor, SkillAuditor, audit.agents/skills/all, audit.ts | Integration: `audit agents` against real .claude/agents/ | Medium |
| E (MCP + Integration) | McpClient, SchemaRegistry, mcp.*, cli.ts, bin.ts | Integration: requires running MCP server | High |

### Key Decisions

| Decision | Choice | Rationale | Confidence |
|----------|--------|-----------|-----------|
| Persistence | Port effect-crdts to Effect 4.x | Concurrent safety for SchemaRegistry; user decision | 0.70 |
| Audit scope | Full 9+28 phases | Complete audit engine from day one; user decision | 0.80 |
| Unification | Single CLI binary | Shared infra (Config, Yaml), single install; user decision | 0.85 |
| Structure | Flat ~28 files | PascalCase/dot naming convention is sufficient grouping; user decision | 0.85 |
| MCP transport | Stdio via @effect/platform/Command | Native Effect integration, kill+respawn on errors | 0.80 |
| Memory schema | Unified fractal graph | Full schema from day one | 0.85 |

## Confidence Scores

| Phase | Confidence |
|-------|-----------|
| 1. Context Excavation | 0.84 |
| 2. Constraint Mapping | 0.88 |
| 3. Failure Mode Analysis | 0.80 |
| 4. Solution Architecture | 0.84 |
| R1 (Principal Engineer) | 7/10 |
| R2 (Devil's Advocate) | 4/10 |
| **Overall** | **0.72** |

### Key Caveats

1. **effect-crdts port to Effect 4.x** — Uncharted territory. The library is small (~2k LOC) but depends on Effect 3.x STM and Schema APIs that may have changed. Fallback: plain JSON persistence if port proves too costly.
2. **effect/unstable/ai** — API may change. Pin exact versions. Fallback: wrap official MCP SDK with Effect.
3. **28-phase skill audit** — Comprehensive but untested against real skills. May produce false positives that erode trust.
4. **Flat 28-file structure** — Works now; monitor for cognitive load as features grow. If it becomes a wall, add 3 shallow dirs.

## R1 Recommendations (Applied)

1. ~~Resolve CRDT contradiction~~ → User chose: port effect-crdts to Effect 4.x
2. Design MCP server config resolution (how `<server>` maps to command) — **STILL OPEN**
3. Move Bun stdio validation to Phase A — **ACCEPTED** (add smoke test)
4. ~~Specify memory version detection~~ → Resolved: unified schema, no versions to detect

## R2 Issues (User Overrode)

| Issue | R2 Score | User Decision |
|-------|---------|--------------|
| effect-crdts/Effect 4.x incompatibility | 2/10 | Port it |
| 28 flat files vs 15+dirs | 3/10 | Keep flat |
| 28-phase audit overkill | 2/10 | Build it all |
| unstable/ai risk | 3/10 | Accept risk, pin versions |
| Unification questioned | 4/10 | Keep unified |

These were informed, deliberate choices. The user accepts the risk profile.
