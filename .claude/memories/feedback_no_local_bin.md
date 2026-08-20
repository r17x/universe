---
name: Never install to ~/.local/bin
description: Never copy binaries to ~/.local/bin — Nix manages all binary paths
type: feedback
updated: 2026-05-30
---

Never copy binaries to `~/.local/bin` or any user bin directory. This is a Nix-managed system — binaries are installed through Nix packages/overlays, not manual copies.

**Why:** The user explicitly blocked this. Nix manages all PATH entries and binary installations. Manual copies bypass the declarative system and create drift.

**How to apply:** When testing a locally-built binary, run it directly from the build output (e.g., `./out/anakmagang web`) or use `bun run src/bin.ts` for source-based testing. Never `cp` to any bin directory.
