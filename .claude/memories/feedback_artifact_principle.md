---
name: artifact-principle
description: Artifacts are deliberate coordinator knowledge products, not auto-tracked file changes — two orthogonal planes (git vs machine output)
type: feedback
updated: 2026-05-25
---

Artifacts are **coordinator-authored knowledge products** materialized as documents in session output dirs.

**Two orthogonal tracking planes:**
- **Git/DirtyBits** → tracks codebase changes → provides context (always there)
- **Machine/Artifact stores** → tracks curated session outputs → provides context *contextually* (on-demand)

**Why:** rule: Do NOT auto-track dirty files as artifacts. Do NOT reflexively produce artifacts on every phase. Workers are ephemeral — they don't produce artifacts; the coordinator does.
**How to apply:** When the coordinator discovers or synthesizes knowledge during a session that is:
1. Denser than a reflection (too detailed for a manifest observation)
2. More reusable than a conversation turn (useful to workers or future sessions)
3. At risk of being lost to compaction or session boundaries

Then **concretize it as a document artifact** via `anakmagang eval --add <path> --session <id>`.

Examples of valuable artifacts:
- macOS socket constants reference table (research output)
- Cross-compilation boundary maps
- Architecture decision records for specific problems
- Runtime/compiler/transpiler distinction tables

Every artifact is a future context tax when loaded. Quality over quantity. Curated, not automated. The `kind: Artifact` store in config.yaml is a capability, not an auto-generation policy.
