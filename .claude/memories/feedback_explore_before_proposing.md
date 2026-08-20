---
name: Explore deeply before proposing solutions
description: User wants independent exploration of Effect modules and references — don't just follow hints, discover alternatives
type: feedback
updated: 2026-05-30
---

When the user gives feedback like "adjust" or hints at a direction, explore the design space independently before proposing the next version.

**Why:** User went through 6 rounds of feedback on Ulid.ts because early proposals were shallow. Each "Adjust" answer was the user saying "you didn't look deep enough." The user wants to see that the coordinator discovered alternatives (Predicate.mapInput, Random module, Schema.brand, Arr.makeBy) through its own exploration of Effect modules and .anakmagang/references/.

**How to apply:**
- When user says "explore more" or gives a hint, grep Effect's source modules for relevant exports
- Check .anakmagang/references/ for patterns in real Effect codebases
- Use LSP/hover to understand types
- Present genuinely different alternatives, not variations of the same idea
- Show the exploration path (what you found, where), not just the result
- Before changing ANY module, fully explore it first — collect all information before proposing changes
- When learning a pattern from one module (e.g. session 01KRC2Y4MWEW6D33VTKJ5ZS7GW/Ulid.ts), study the details of how it was done before applying to other modules
- Don't rush to completion — correctness and quality are non-negotiable, speed is secondary

**Session 01KRC5M78S7Q5TE4SV2Q6CJCXA learning:**
- Schema.is is for VALIDATION → TYPE GUARD patterns (isUlid, isValidSkillName), not for every boolean predicate
- Keep simple predicates as-is (isAbsolutePath: 4 startsWith checks are readable, Schema adds no type-safety benefit)
- pipe+Arr.takeWhile for counting characters is an anti-pattern when regex does it natively
- Mechanical "Array.from count" doesn't determine best candidate — understand whether the pattern is validation (Schema.is) or safety check (keep hand-written)

---

### Artifact-First for Research Tasks (2026-05-30)

When performing research/exploration tasks that produce written findings, **always create the artifact file FIRST** before outputting findings inline in the conversation. Use `anakmagang eval --add <path> --session <id>` to track it immediately. Conversation context can be lost to compaction or interruption — the artifact is the durable record.

**Why:** During session 01KSWQTR6DA41H11J35AWFB944, the research comparison was output inline but not persisted as an artifact. The user had to intervene to prevent data loss.

**How to apply:** For any task producing research findings, write the artifact file before or alongside the inline output. Never rely solely on conversation context for research deliverables.