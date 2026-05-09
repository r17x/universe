---
name: Generic abstractions over provider-specific methods
description: Prefer generic typed store (readJson/writeJson + Schema) over provider-named methods (readClaudeBridge)
type: feedback
updated: 2026-05-06
---

Build generic abstractions instead of provider-specific methods.

**Why:** `readClaudeBridge`/`writeClaudeBridge`/`resolveByClaudeSid` were too specific — named after the provider (Claude), tightly coupled, and used `object` type with unsafe casts. The alchemy-effect pattern shows how: a generic `get`/`set` with typed schemas. The fix was `readJson(sid, namespace, key, schema)` / `writeJson(sid, namespace, key, data)` / `resolveByKey(namespace, key)` — the bridge becomes just `readJson(sid, "claude", claudeSid, BridgeData)`.

**How to apply:** When adding a new data access pattern, ask: "Is this generic or provider-specific?" If the method name contains a provider/consumer name (e.g., `readClaudeBridge`, `writeSlackWebhook`), it's too specific. Make the storage generic (namespace + key + schema) and let the caller own the schema and namespace. Parse external data with Effect Schema — never `JSON.parse as object`.
