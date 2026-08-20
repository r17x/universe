---
name: Always run orchestrate first
description: Never skip /orchestrate even for seemingly trivial tasks - the hook reminder is mandatory
type: feedback
updated: 2026-05-18
---

Always run `/orchestrate` as the FIRST action on every task — no exceptions, no "this is too small" judgment calls.

**Why:** User corrected after I processed a CLAUDE.md update without running `/orchestrate` despite the hook firing a mandatory reminder on every prompt. The protocol exists for consistency and phase tracking, not just for large tasks.

**How to apply:** When the `UserPromptSubmit` hook fires the orchestrate warning, STOP and run `/orchestrate` before any other action — before reading files, before exploring, before delegating.
