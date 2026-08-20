---
name: serviceOption for guard extensions
description: Use Effect.serviceOption to add optional service dependencies to guards without changing GuardDeps
type: feedback
updated: 2026-05-22
---

To add new capabilities to guards without modifying GuardDeps or the provide helper in Middleware.ts:
1. Define a Context.Service with a Layer
2. Add the Layer to HookLayers in hook.ts
3. In the guard, use `yield* Effect.serviceOption(MyService)` for optional access

**Why:** GuardDeps is a closed union (`EventLog | FileSystem | Path | Bridge`). Changing it breaks all guards. `Effect.serviceOption` finds services in the ambient fiber context without declaring them as requirements.

**How to apply:** When extending guard behavior with new data sources (experimental features, analytics, etc.), follow the MemoryStore/ExperimentalFeatures precedent — never modify GuardDeps or the `provide` helper.

Proven in: ExperimentalFeatures service (session 01KS7E8WHDAQVENCFR4RA6S99W)
