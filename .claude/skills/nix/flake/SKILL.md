---
name: nix-flake
description: Debug and evaluate Nix flake expressions
allowed-tools:
  - Bash
  - Read
---

# Nix Flake Debugging

## Flake Structure

```bash
# Show all outputs
nix flake show
nix flake show --json | jq

# Metadata and inputs
nix flake metadata
nix flake metadata --json | jq '.locks.nodes | keys'

# Check validity
nix flake check
nix flake check --show-trace
```

## nix eval Patterns

```bash
# Basic evaluation
nix eval .#attr
nix eval .#attr --json | jq
nix eval .#attr --raw               # No quotes for strings
nix eval .#attr --apply 'f'         # Apply function

# Common flake paths
nix eval .#darwinConfigurations.<host>.config.<path>
nix eval .#darwinConfigurations.<host>.options.<path>
nix eval .#homeConfigurations."<user>@<host>".config.<path>
nix eval .#nixosConfigurations.<host>.config.<path>
nix eval .#packages.<system>.<name>.meta

# Introspection
nix eval .#someSet --apply builtins.attrNames
nix eval .#someSet --apply 'x: builtins.mapAttrs (k: v: builtins.typeOf v) x'

# Debug flags
nix eval .#attr --show-trace        # Stack trace
nix eval .#attr --debugger          # Interactive debugger
```

## nix repl Deep Dive

```bash
nix repl --expr 'builtins.getFlake (toString ./.)'
```

### Commands
```
:?                  Help
:p EXPR             Pretty print
:t EXPR             Show type
:b DRV              Build
:l PATH             Load file
:lf FLAKE           Load flake
:r                  Reload
:doc FN             Documentation
```

### Discovery Patterns
```nix
# What's in this set?
builtins.attrNames darwinConfigurations

# What type is it?
builtins.typeOf someValue

# Function arguments
builtins.functionArgs someFn

# Where is this defined?
builtins.unsafeGetAttrPos "attr" someSet

# Option definition sources
options.services.nginx.enable.definitionsWithLocations
```

## Input Management

```bash
# Update all
nix flake update

# Update specific input
nix flake lock --update-input nixpkgs

# Override input temporarily
nix build .#pkg --override-input nixpkgs path:/local/nixpkgs

# Show input tree
nix flake metadata --json | jq '.locks.nodes'
```

## Error Diagnosis

| Error | Quick Fix |
|-------|-----------|
| `attribute missing` | `--apply builtins.attrNames` |
| `infinite recursion` | `--show-trace`, check imports |
| `unexpected argument` | Check `builtins.functionArgs` |
| `cannot coerce` | Use `toString` or `toJSON` |
| `not a valid flake` | Check `flake.nix` syntax |
