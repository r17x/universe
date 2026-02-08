# Suggested Commands

## Darwin (macOS) System Management

### Build and Switch Configuration
```bash
# Build the Darwin configuration
nix build .#darwinConfigurations.$HOSTNAME.system -o /tmp/result

# Switch to the new configuration
/tmp/result/sw/bin/darwin-rebuild switch --flake .#$HOSTNAME

# Or use the provided aliases (after initial setup):
drb   # darwin rebuild - rebuild this nixpkgs
drs   # darwin rebuild and switch to the new version
```

### Version Management
```bash
lenv           # List available build versions
senv <VERSION> # Switch to a specific version (rollback)
```

## Development Shells

```bash
# Enter default development shell (with pre-commit hooks)
nix develop

# Enter specific development environment
nix develop .#ocaml          # OCaml development
nix develop .#nodejs22       # Node.js 22
nix develop .#go             # Go development
nix develop .#rust-wasm      # Rust with WASM support
nix develop .#bun            # Bun runtime

# Use with direnv (create .envrc in project)
echo "use flake .#node20" > .envrc
direnv allow
```

## Formatting and Linting

```bash
# Format all Nix files
nix fmt

# Run pre-commit hooks manually
pre-commit run --all-files

# Individual tools:
nixfmt-rfc-style <file.nix>  # Format Nix file
deadnix <file.nix>           # Find dead code
```

## Process Compose Services

```bash
# Start AI services (Ollama)
nix run .#ai

# Start MySQL/MariaDB services
nix run .#mysql
```

## Flake Operations

```bash
# Update all flake inputs
nix flake update

# Update specific input
nix flake lock --update-input nixpkgs

# Show flake outputs
nix flake show

# Check flake for issues
nix flake check
```

## Secrets Management (SOPS)

```bash
# Edit encrypted secrets
sops secrets/<filename>

# Decrypt and view
sops -d secrets/<filename>
```

## Git Operations

```bash
git status
git add <files>
git commit -m "message"
git push
```

## System Utilities (Darwin/macOS)

```bash
# Standard Unix utilities work on Darwin:
ls, cd, grep, find, cat, etc.

# macOS specific:
open <file>           # Open file with default app
pbcopy / pbpaste      # Clipboard operations
defaults              # macOS preferences
```
