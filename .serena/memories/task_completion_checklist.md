# Task Completion Checklist

When completing a task in this repository, follow these steps:

## Before Committing

### 1. Format Code
```bash
# Format all Nix files
nix fmt

# Or format specific files
nixfmt-rfc-style <modified-files.nix>
```

### 2. Run Linters
```bash
# Run all pre-commit hooks
pre-commit run --all-files
```

The pre-commit hooks will automatically check:
- **deadnix** - Unused Nix code detection
- **nixfmt-rfc-style** - Nix formatting
- **shellcheck** - Shell script issues
- **actionlint** - GitHub Actions validation
- **stylua** - Lua formatting
- **dune-fmt** - OCaml formatting (for apps/rin.rocks)

### 3. Build Test
```bash
# Test that the flake still builds
nix flake check

# Or build a specific configuration
nix build .#darwinConfigurations.eR17x.system
```

## After Changes to System Configuration

### 4. Test Configuration Locally
```bash
# Build and switch to test changes
nix build .#darwinConfigurations.$HOSTNAME.system -o /tmp/result
/tmp/result/sw/bin/darwin-rebuild switch --flake .#$HOSTNAME
```

## Common Issues to Avoid

- **Dead code**: Remove unused imports and bindings
- **Formatting**: Always run `nix fmt` before committing
- **Type mismatches**: Ensure attribute sets match expected module options
- **Missing inputs**: Verify all flake inputs are properly referenced

## When Adding New Modules

1. Place module in appropriate directory:
   - `nix/modules/home/` for home-manager modules
   - `nix/modules/darwin/` for Darwin modules
   - `nix/modules/nixos/` for NixOS modules
   - `nix/modules/cross/` for cross-platform modules
   - `nix/modules/flake/` for flake modules

2. Modules are auto-discovered by ez-configs - no manual import needed

3. Follow existing module patterns for consistency
