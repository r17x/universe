---
name: Never batch destructive operations without inspection
description: Always inspect each item individually before any delete/drop/rm — never batch destroy without asking
type: feedback
updated: 2026-05-06
---

NEVER batch destructive operations. On 2026-05-06, coordinator dropped ALL 4 sessions including a real implementation session (`session-1etsceev`) that had reflections and observations from actual work — treating it the same as 3 test sessions.

**Why:** The session data was irrecoverable (gitignored ephemeral state). Real work history was permanently lost because of laziness.

**How to apply:**
- Before ANY drop/delete/rm: inspect each item individually, distinguish real from test
- Always ask the user before deleting anything that wasn't created in the current conversation
- When a stop-hook blocks, fix only the specific blocker — don't nuke everything
- Destructive operations require explicit user confirmation, per the system rules. No exceptions.
