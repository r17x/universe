# Complete Verification

## When to use

After completing a task that spans multiple module types, or before marking a task as done.

## Steps

1. **Nix evaluation check**:
   ```bash
   nix flake check --no-build
   ```

2. **Darwin config check**:
   ```bash
   nix eval .#darwinConfigurations.eR17.config --apply builtins.attrNames
   nix eval .#darwinConfigurations.eR17x.config --apply builtins.attrNames
   ```

3. **Home-manager config check**:
   ```bash
   nix eval .#homeConfigurations."r17@eR17".config --apply builtins.attrNames
   ```

4. **Format check**:
   ```bash
   nix fmt -- --check .
   ```

5. **Full flake check with pre-commit** (includes deadnix, nixfmt, stylua, shellcheck):
   ```bash
   nix flake check
   ```

6. **Pre-commit runs automatically on commit** — no need to run manually.

## When to Use Full vs Partial

### Full verification (all 5 steps)
- Changes spanning darwin + home + nixos modules
- New modules or configurations
- Changes to flake inputs or flake-parts structure
- Before merging to main

### Partial: Darwin only (steps 1-2)
- Changes only in `nix/modules/darwin/` or `nix/configurations/darwin/`
- No home-manager modifications

### Partial: Home only (steps 1, 3)
- Changes only in `nix/modules/home/` or `nix/configurations/home/`
- No darwin modifications

### Minimal: Trivial changes (step 1 only)
- Single-line fixes, option tweaks
- Run only `nix flake check --no-build`

## Notes

- NEVER use `nix build` or `darwin-rebuild` for verification
- Pre-commit hooks are the safety net — they catch formatting and dead code
- Correct code > formatted code — verify behavior, not just syntax
