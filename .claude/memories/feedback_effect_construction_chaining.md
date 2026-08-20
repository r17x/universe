---
name: Effect constructors + native chaining
description: Use Effect constructors (Arr.makeBy, Arr.fromIterable) for construction but native .map()/.join() for standard transforms — don't over-pipe
type: feedback
updated: 2026-05-12
---

Use Effect Array constructors for construction, but native JS methods for standard transforms.

**Why:** User corrected over-use of `pipe(Arr.makeBy(...), Arr.join(""))` — the `pipe` wrapper adds noise when native `.join("")` works directly. Effect's `Arr.makeBy` returns `NonEmptyArray` and `Arr.fromIterable` returns `Array` — both have native `.map()`, `.join()`, `.filter()` etc.

**How to apply:**
- `Arr.makeBy(n, f).join("")` — NOT `pipe(Arr.makeBy(n, f), Arr.join(""))`
- `Arr.fromIterable(x).map(f).join("")` — NOT `pipe(Arr.fromIterable(x), Arr.map(f), Arr.join(""))`
- Use `pipe()` or Effect combinators only when the operation IS Effect-specific (e.g., `Arr.unfold`, `Arr.every` with type narrowing, `Arr.head` returning Option)
- Rule of thumb: if the native method does exactly the same thing, use it