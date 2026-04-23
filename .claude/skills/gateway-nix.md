# Nix Gateway

## When to use

When the task involves Nix expressions, nix-darwin modules, home-manager configs, NixOS modules, overlays, packages, or anything under `nix/`, `flake.nix`, or `secrets/`.

## Steps

1. **Detect task type** — Examine which area is involved:
   - Darwin module (system, WM, homebrew, network, GPG) → darwin work
   - Home-manager module (git, shells, terminal, tmux, packages) → home work
   - NixOS module → nixos work
   - Cross-platform module (nix settings, nixpkgs, Fish) → cross work
   - Flake config (inputs, outputs, flake-parts, ez-configs) → flake work
   - Overlay or custom package → overlay/package work
   - Neovim config (nixvim) → nvim work
   - Secrets (sops-nix) → secrets work

2. **Load relevant Tier 2 skills** based on task type:

   ### Darwin modules
   ```
   .claude/skill-library/darwin-patterns.md
   ```

   ### Home-manager modules
   ```
   .claude/skill-library/home-patterns.md
   ```

   ### Flake/cross-platform
   ```
   .claude/skill-library/flake-patterns.md
   .claude/skill-library/cross-platform.md
   ```

   ### Overlays/packages
   ```
   .claude/skill-library/overlay-patterns.md
   ```

   ### Secrets
   ```
   .claude/skill-library/sops-patterns.md
   ```

3. **Route to appropriate agent**:
   - All `.nix` files → delegate to `nix-coder` agent
   - Non-Nix files (`.md`, `.sh`, `.yaml`, `.lua`) → handle directly or delegate to default agent
   - Never use `nix-coder` for markdown, shell scripts, or YAML

4. **Verify with fast commands**:
   ```bash
   # Fast flake validation
   nix flake check --no-build

   # Check specific config
   nix eval .#darwinConfigurations.eR17.config --apply builtins.attrNames
   nix eval .#homeConfigurations."r17@eR17".config --apply builtins.attrNames
   ```

5. **Check critical requirements**:
   - Module follows `{ lib, config, pkgs, ... }:` signature
   - Options use `lib.mkEnableOption` / `lib.mkOption`
   - Platform conditionals use `lib.mkIf pkgs.stdenv.isDarwin`
   - No hardcoded paths — use `lib.getExe`, `pkgs.*`

## Darwin Hosts

| Host | Description |
|------|-------------|
| `eR17` | Base: Fish, aerospace WM, homebrew, fonts, GPG |
| `eR17x` | Extends eR17: dnscrypt-proxy + unbound DNS, Tailscale, linux-builder |

## Notes

- NEVER use slow build or legacy instantiate commands
- Formatter is `nixfmt-rfc-style` — pre-commit handles it
- Dead code checked by `deadnix`
- When clarifications needed, use `AskUserQuestion` tool
