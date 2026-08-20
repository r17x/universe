---
name: Bun-native APIs before Node polyfills
description: When project targets Bun, check Bun global APIs first before reaching for Node built-ins or third-party alternatives
type: feedback
updated: 2026-05-28
---

Always check the target runtime's native APIs before reaching for Node built-ins or third-party alternatives.

**Why:** During hash API selection, the initial spike only compared Node `crypto` vs Effect `Hash`, missing `Bun.hash` entirely — the user had to point out this project targets Bun. `Bun.hash` turned out to be 5-7x faster than Node `crypto` with zero collisions, and requires no import (global).

**How to apply:**
- When selecting APIs for I/O, hashing, file ops, spawning, etc. — check `Bun.*` globals first
- `Bun.hash` (wyhash) for non-cryptographic hashing (identifiers, keys, fingerprints)
- `Bun.CryptoHasher` for standard cryptographic digests (SHA-256) — 28% faster than Node `crypto`
- Effect `Hash` only for Effect data structure integration (HashMap, HashSet, Equal protocol)
- `crypto.getRandomValues()` is Web Crypto API (global), already Bun-compatible — no change needed
- `Bun.connect()` returns a Promise — use `.catch(() => {})` for fire-and-forget socket calls (unlike Node `net.connect` which defers to EventEmitter)
- `Bun.write()` for file writes, `Bun.file(path).delete()` for deletion, `new TextDecoder().decode(data)` instead of `Buffer.from(data).toString()`
- `Bun.env.HOME` instead of `require("os").homedir()`, `Bun.env.TMPDIR ?? "/tmp"` instead of `require("os").tmpdir()`
- EXCEPTION: `require("fs").readFileSync` + `__dirname` is required for Bun compiled binary file embedding — `import.meta.dir` resolves to virtual `/$bunfs/root/` in compiled binaries
- The spike methodology (benchmark + collision test + scenario matrix) is effective for API selection decisions