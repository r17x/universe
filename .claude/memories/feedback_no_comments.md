---
name: No code comments
description: User prefers self-documenting code — no comments unless truly needed for non-obvious WHY
type: feedback
updated: 2026-05-03
---

Code should speak for itself. Do not write comments that describe what the code does.

**Why:** The user considers inline comments, section banners, and JSDoc that restate function names to be noise. They add maintenance burden without value when the code is clear.

**How to apply:** When writing or editing code, never add comments unless they explain a genuinely non-obvious reason (WHY, not WHAT). Remove section separator banners (`// ====`, `// ----`), inline labels (`// null`, `// phases`), and JSDoc that restates the signature. If a comment is needed to explain code, consider renaming the variable or function instead.
