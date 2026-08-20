---
name: No global Claude memory storage
description: Never store memories in ~/.claude/ — only use project-local .claude/memories/
type: feedback
---

Never write to `~/.claude/projects/*/memory/`. All memories go in the project-local `.claude/memories/` directory.

**Why:** User explicitly rejected storing memory in `~/.claude/**`.

**How to apply:** When saving memories, always target `.claude/memories/` within the project working directory, never the global `~/.claude/` path.
