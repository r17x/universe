# R17{x} Universe — Architecture

Declarative system configuration for macOS (nix-darwin), NixOS, and home-manager via Nix flakes.

## Quick Reference

- **Rebuild macOS**: `universe rebuild` or `sudo darwin-rebuild switch --flake .`
- **Format code**: `nix fmt` (uses `nixfmt-rfc-style`)
- **Check pre-commit**: `nix flake check` (runs deadnix, nixfmt-rfc-style, stylua, shellcheck, actionlint, dune-fmt)
- **Dev shell**: `nix develop` (default shell with pre-commit hooks)
- **Manage identities**: `universe identity --list`, `universe identity --add <name> <real_name> <email>`
- **Manage services**: `universe service`

## Repository Structure

```
flake.nix                          # Entry point — uses flake-parts + ez-configs
nix/
  default.nix                      # Main flake module imports and configuration
  devShells.nix                    # Development environments (Node, Go, OCaml, Rust, Bun)
  nvim.nix/                        # Neovim configuration (nixvim)
  colors.nix / icons.nix           # Shared color scheme and icon definitions
  configurations/
    darwin/eR17.nix                # Base macOS config (aarch64-darwin)
    darwin/eR17x.nix               # Extended macOS config (adds DNS, Tailscale, linux-builder)
    home/r17.nix                   # Home-manager config for user r17
    nixos/vm.nix                   # NixOS VM config (microvm)
  modules/
    cross/                         # Platform-agnostic (nix settings, nixpkgs config, Fish shell)
    darwin/                        # macOS modules (system, mouseless WM, homebrew, network, GPG, etc.)
    home/                          # User modules (git, shells, terminal, tmux, packages, etc.)
    nixos/                         # NixOS modules (user config)
    flake/                         # Flake-level (universe CLI, rebuild scripts, pkgs-by-name)
  overlays/                        # Custom overlays (OCaml packages, Node packages, macOS apps, vim)
  packages/                        # Custom per-system packages (discovered via pkgs-by-name)
secrets/                           # SOPS-encrypted secrets (secret.yaml)
apps/                              # Custom applications (norg, rin.rocks)
notes/                             # Personal notes (.norg format)
```

## Flake Architecture

- **flake-parts** composes the flake modularly via `nix/default.nix`
- **ez-configs** auto-discovers configurations and modules from directory conventions
- Global args (`self`, `inputs`, `icons`, `colors`, `color`, `crossModules`) flow to all modules
- Three nixpkgs channels available as `pkgs.branches.{stable, master, unstable}`
- Overlays are applied globally via `inputs.self.nixpkgs.overlays`

## Darwin Hosts

| Host | Description |
|------|-------------|
| `eR17` | Base: Fish shell, aerospace WM, homebrew, fonts, GPG |
| `eR17x` | Extends eR17: dnscrypt-proxy + unbound DNS, Tailscale, linux-builder VM |

## Domain → Worker Routing

| Domain | File Patterns | Worker Agent |
|--------|--------------|-------------|
| Darwin modules | `nix/modules/darwin/**/*.nix`, `nix/configurations/darwin/*.nix` | `nix-coder` |
| Home modules | `nix/modules/home/**/*.nix`, `nix/configurations/home/*.nix` | `nix-coder` |
| NixOS modules | `nix/modules/nixos/**/*.nix`, `nix/configurations/nixos/*.nix` | `nix-coder` |
| Cross modules | `nix/modules/cross/**/*.nix` | `nix-coder` |
| Flake modules | `nix/modules/flake/**/*.nix`, `nix/default.nix`, `flake.nix` | `nix-coder` |
| Overlays | `nix/overlays/**/*.nix` | `nix-coder` |
| Packages | `nix/packages/**/default.nix` | `nix-coder` |
| Neovim | `nix/nvim.nix/**/*.nix` | `nix-coder` |
| Secrets | `secrets/*.yaml`, `.sops.yaml` | default (sops CLI) |
| Docs/scripts | `*.md`, `*.sh`, `*.lua`, `*.yaml` | default |

## Nix Conventions

- Formatter: `nixfmt-rfc-style` (enforced by pre-commit)
- Dead code: checked by `deadnix` (excludes `nix/overlays/nodePackages/node2nix`)
- Module options use `lib.mkEnableOption` / `lib.mkOption` patterns
- Custom vim plugins use `vimPlugins_` prefix in flake inputs
- nixpkgs follows `nixpkgs-unstable`

## Secrets

Managed via `sops-nix`. Secrets file: `secrets/secret.yaml`. Contains GPG keys, git identities, API keys. SOPS uses GPG for encryption. Never commit decrypted secrets.

## Verification Commands

```bash
# Fast validation (always run)
nix flake check --no-build

# Darwin config check
nix eval .#darwinConfigurations.eR17.config --apply builtins.attrNames
nix eval .#darwinConfigurations.eR17x.config --apply builtins.attrNames

# Home-manager config check
nix eval .#homeConfigurations."r17@eR17".config --apply builtins.attrNames

# Format check
nix fmt -- --check .

# Full check with pre-commit (includes deadnix, nixfmt, stylua, shellcheck)
nix flake check
```

## Key Commands

```sh
# Development shells
nix develop .#ocaml          # OCaml 5.1
nix develop .#rust-wasm      # Rust + WASM
nix develop .#nodejs22       # Node.js 22
nix develop .#bun            # Bun runtime
nix develop .#go             # Go

# Process compose services
nix run .#ai                 # Ollama with deepseek-r1:1.5b
nix run .#mysql              # MariaDB instances on ports 3307-3309

# Universe CLI
universe rebuild             # darwin-rebuild switch
universe identity --list     # List git identities
universe service             # Manage launchd/systemd services
```
