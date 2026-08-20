---
name: New features require full phase analysis
description: Size classification should consider novelty/criticality, not just LOC — new features are critical path
type: feedback
updated: 2026-05-13
---

New features should be classified MEDIUM or LARGE, never SMALL or TRIVIAL, regardless of line count.

**Why:** User corrected a SMALL classification on a new `draft` command (~50 LOC, 3 files). New features introduce new behavior, new contracts, and new integration surface — they deserve full discovery, complexity analysis, brainstorming, and architecture phases even if the implementation is compact.

**How to apply:** When classifying task size, ask: "Is this a new feature or a modification of existing behavior?" New features = MEDIUM minimum. Only use SMALL/TRIVIAL for bug fixes, typos, config changes, or mechanical refactors within existing patterns. LOC is a poor proxy for complexity — novelty and integration risk matter more.
