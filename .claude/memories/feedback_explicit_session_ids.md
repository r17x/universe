---
name: Explicit session IDs over implicit resolution
description: State machines require explicit identity — no env vars, no first-active-wins fallback
type: feedback
updated: 2026-05-06
---

Prefer making parameters required over adding resolution/lookup magic.

**Why:** Two Claude Code sessions racing caused one to block because resolveSession used first-active-wins. The initial fix attempted CLAUDE_SESSION_ID env var lookup — user corrected: env vars are invalid state for CLI commands. The correct fix was removing resolveSession entirely and making --session required.

**How to apply:** When a state machine operation needs identity (session, task, etc.), require it explicitly as a parameter. Never guess via scanning, env vars, or "find first active." Removing code (optional → required) is stronger than adding code (bridge lookup fallback).
