---
name: machine-agent role separation
description: Agent classifies and thinks, machine tracks state — size is agent output during Setup
type: feedback
updated: 2026-05-05
---

The agent classifies, the machine tracks. Size is the agent's output from Phase 1 (Setup), not an input to session creation.

**Why:** The agent and machine are complementary — the agent thinks (classifies, discovers, reflects), the machine tracks (phase transitions, state persistence, session isolation). Size classification is the agent's judgment call during Setup work.

**Correct flow:**
1. `/orchestrate` runs → agent begins orchestration
2. `anakmagang start "<task>"` → machine creates session at phase 1/setup
3. Agent does Setup work (reads ARCHITECTURE.md, memories, past feedback)
4. Agent classifies size (TRIVIAL / SMALL / MEDIUM / LARGE)
5. `anakmagang next "<reflection>" --size <SIZE>` → completes setup, machine computes active phases

**How to apply:** Always run `/orchestrate` first. `start` initializes without size. The first `next` call provides the size after the agent has done its analysis. The machine blocks advancement from setup until size is provided.
