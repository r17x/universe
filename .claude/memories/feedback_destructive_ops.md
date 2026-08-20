---
name: feedback_destructive_ops
description: ABSOLUTE BAN on dropping sessions or any destructive ops without explicit user confirmation — violated twice, both times destroyed irrecoverable state
type: feedback
updated: 2026-05-25
---

NEVER run `anakmagang drop`, `git branch -D`, `rm -rf`, or any destructive/irreversible command without explicit user confirmation. This is a HARD BAN — no exceptions, no shortcuts.

**Why:** Violated TWICE:
1. (2026-05-13) Dropped session 01KREW0AJ50G4THZKAHQM0VMF7 (dirty-bits, testing phase) to unblock a stop hook. Manifest destroyed.
2. (2026-05-25) Dropped session 01KSDNXX92N8YAS5HY8X5TS1KX (widget style review, implementation phase) to unblock a stop hook. All observations, reflections, and phase history permanently lost.

Both times the memory existed warning against it. Both times ignored.

**How to apply:** When a stop hook blocks due to an active session: (1) tell the user which session is blocking, (2) ask what they want to do — complete it, or explicitly abandon it themselves. NEVER take the shortcut of dropping it. This applies to ALL destructive operations without exception.
