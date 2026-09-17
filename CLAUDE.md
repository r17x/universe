# R17{x} Universe

Declarative system configuration for macOS (nix-darwin), NixOS, and home-manager via Nix flakes.

Read `.gitignore` first — it uses an allowlist pattern (`*` then `!`) that defines exactly which files and extensions exist in this repository; do not assume files exist outside of it.

## Quick Reference

- **Rebuild macOS**: `universe rebuild` or `sudo darwin-rebuild switch --flake .`
- **Format code**: `nix fmt` (uses `nixfmt-rfc-style`)
- **Check pre-commit**: `nix flake check` (runs deadnix, nixfmt-rfc-style, stylua, shellcheck, actionlint, dune-fmt)
- **Dev shell**: `nix develop` (default shell with pre-commit hooks)
- **Manage identities**: `universe identity --list`, `universe identity --add <name> <real_name> <email>`
- **Manage services**: `universe service`

## Repository Structure

```
flake.nix                          # Entry point — flake-parts + den
r17.nix                            # User registry data — edit this to change preferences
nix/
  den/
    default.nix                    # Den configuration — hosts, defaults, policies
    aspects/                       # Aspect definitions (18 aspects)
      machine.nix                  # Host definitions (eR17, eR17x) + tests
      shell.nix                    # Shell (fish, aliases, prompt, tools)
      desktop.nix                  # Window management (aerospace, sketchybar)
      terminal.nix                 # Terminal (ghostty, tmux)
      packages.nix                 # Packages (system, fonts, homebrew, user)
      git.nix                      # Git config + url rewrites
      secrets.nix                  # SOPS-nix, GPG trust, pass
      identity.nix                 # GPG agent, pinentry
      mail.nix                     # Email (himalaya)
      network.nix                  # DNS (unbound + dnscrypt) + mesh (yggdrasil)
      builder.nix                  # Linux builder VM
    schema/user.nix                # User schema type definitions + policy wiring
    classes/tests.nix              # Test class definition
    tests/                         # Den framework tests
  modules/
    cross/nix.nix                  # Cross-platform nix settings
    darwin/                        # macOS modules (unbound, yggdrasil)
    flake/                         # Flake modules (universe CLI, pkgs-by-name)
  configurations/nixos/vm.nix      # NixOS VM config (microvm)
  overlays/                        # Custom overlays (OCaml, Node, macOS apps, vim)
  packages/                        # Custom packages (pkgs-by-name)
  colors.nix / icons.nix           # Shared color scheme and icon definitions
  devShells.nix                    # Development environments (Node, Go, OCaml, Rust, Bun)
  nvim.nix                         # Neovim configuration (nixvim)
secrets/                           # SOPS-encrypted secrets (secret.yaml)
apps/                              # Custom applications (norg, rin.rocks)
notes/                             # Personal notes (.norg format)
```

## Architecture

- **Den** aspect-oriented framework composes the system via `nix/den/default.nix`
- **flake-parts** composes the flake modularly
- User preferences centralized in `den.users.registry` (`r17.nix`)
- Aspects read from `user.*` args — changing preferences = edit registry only
- Global args (`icons`, `colors`, `color`) flow via `policies.theming`
- Three nixpkgs channels available as `pkgs.branches.{stable, master, unstable}`
- Overlays are applied globally via `inputs.self.nixpkgs.overlays`

## Den User Schema

To change user preferences, edit `r17.nix` under `den.users.registry.r17`:

| Field | Type | Used by |
|-------|------|---------|
| `handle` | `str` | mail account key |
| `shell` | `str` | `den.batteries.user-shell` |
| `font` | `str` | terminal.nix (ghostty) |
| `configDirectory` | `str` | shell.nix (aliases, fish functions) |
| `primaryCache` | `str` | shell.nix (cachix push alias) |
| `caches` | `attrsOf { url, key }` | builder.nix (substituters) |
| `secrets` | `listOf str` | secrets.nix (sops secret names) |
| `gpgTrust` | `attrsOf str` | secrets.nix (secret name -> email) |
| `browsers` | `listOf str` | secrets.nix (browserpass) |
| `sessionVariables` | `attrsOf anything` | shell.nix (home.sessionVariables) |
| `sessionPath` | `listOf str` | shell.nix (home.sessionPath) |
| `workspaces` | `attrsOf { path, sessionName }` | terminal.nix (tmux) |
| `packageOverrides` | `attrsOf anything` | shell.nix (atuin), packages.nix (discord) |
| `apps.masApps` | `attrsOf int` | packages.nix (homebrew) |
| `mail` | `attrsOf anything` | mail.nix (email accounts) |
| `git.urlRewrites` | `attrsOf str` | git.nix (extraConfig.url) |
| `builder` | `{ diskSize, memorySize, cores, maxJobs, systems }` | builder.nix |
| `dns` | `{ dnscrypt, unbound }` | network.nix |
| `mesh` | `{ peers, publicKey, settings }` | network.nix |

Aspects use `{ user, ... }:` to access registry data. Den auto-promotes these to parametric aspects (fanned per user entity).

## Darwin Hosts

| Host | Description |
|------|-------------|
| `eR17` | Base: shell, desktop, identity, packages, mail, git, terminal, secrets |
| `eR17x` | Extends eR17: + network (DNS, mesh), builder (linux VM), tailscale |

## Nix Conventions

- Formatter: `nixfmt-rfc-style` (enforced by pre-commit)
- Dead code: checked by `deadnix` (excludes `nix/overlays/nodePackages/node2nix`)
- Module options use `lib.mkEnableOption` / `lib.mkOption` patterns
- Custom vim plugins use `vimPlugins_` prefix in flake inputs
- nixpkgs follows `nixpkgs-unstable`

## Secrets

Managed via `sops-nix`. Secrets file: `secrets/secret.yaml`. Contains GPG keys, git identities, API keys. SOPS uses GPG for encryption. Never commit decrypted secrets.

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
