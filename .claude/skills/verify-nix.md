# Verify Nix

## When to use

After any changes to Nix files. Use the fastest possible verification commands.

## Steps

1. **Fast flake check** (validates expressions parse):
   ```bash
   nix flake check --no-build
   ```

2. **Check darwin config** (0.1-0.5s):
   ```bash
   nix eval .#darwinConfigurations.eR17.config --apply builtins.attrNames
   ```

3. **Check home-manager config** (0.1-0.5s):
   ```bash
   nix eval .#homeConfigurations."r17@eR17".config --apply builtins.attrNames
   ```

4. **Check specific module option**:
   ```bash
   nix eval .#darwinConfigurations.eR17.config.services.<name>.enable
   nix eval .#homeConfigurations."r17@eR17".config.programs.<name>.enable
   ```

5. **Format check**:
   ```bash
   nix fmt -- --check .
   ```

6. **Full flake check with deadnix** (slower, use sparingly):
   ```bash
   nix flake check
   ```

## NEVER Use

- `nix build` without `--dry-run` — takes minutes
- `nix-instantiate` — legacy, slow
- `darwin-rebuild switch` — takes very long, use for final deploy only

## Quick Reference

| Command | Speed | Use When |
|---------|-------|----------|
| `nix eval .#darwinConfigurations.eR17.config --apply builtins.attrNames` | 0.1-0.5s | After darwin module changes |
| `nix eval .#homeConfigurations."r17@eR17".config --apply builtins.attrNames` | 0.1-0.5s | After home module changes |
| `nix flake check --no-build` | 5-15s | After structural changes |
| `nix flake check` | 20-60s | Before committing |
| `nix fmt -- --check .` | 2-5s | Format verification |
