# Flake-Parts and Ez-Configs Patterns

## Architecture

The flake uses `flake-parts` for modular composition and `ez-configs` for auto-discovery.

### Entry point: `flake.nix`
```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    ez-configs.url = "github:ehllie/ez-configs";
    # ... more inputs
  };

  outputs = inputs: inputs.flake-parts.lib.mkFlake { inherit inputs; } {
    imports = [ ./nix ];
  };
}
```

### Main module: `nix/default.nix`
This imports flake-parts modules, ez-configs, and sets up global args.

## Ez-Configs Auto-Discovery

Ez-configs discovers configurations and modules by directory convention:

```
nix/configurations/
  darwin/<hostname>.nix    → darwinConfigurations.<hostname>
  home/<username>.nix      → homeConfigurations.<username>@<hostname>
  nixos/<hostname>.nix     → nixosConfigurations.<hostname>

nix/modules/
  darwin/*.nix             → darwinModules (auto-imported for all darwin configs)
  home/*.nix               → homeModules (auto-imported for all home configs)
  nixos/*.nix              → nixosModules (auto-imported for all nixos configs)
  cross/*.nix              → Shared modules across platforms
  flake/*.nix              → Flake-level modules
```

## Global Args

These flow to all modules via ez-configs `globalArgs`:
- `self` — The flake itself
- `inputs` — All flake inputs
- `icons` — Icon definitions from `nix/icons.nix`
- `colors` — Color scheme from `nix/colors.nix`
- `color` — Color utility functions
- `crossModules` — Cross-platform modules

## Three Nixpkgs Channels

```nix
# Available in all modules via pkgs.branches
pkgs.branches.stable    # nixos-24.11 (or current stable)
pkgs.branches.master    # nixpkgs master
pkgs.branches.unstable  # nixpkgs-unstable (primary)
```

## Adding a New Flake Input

1. Add to `flake.nix` inputs
2. If it's a nixpkgs overlay, add to `nix/overlays/`
3. If it's a module, import in the appropriate config
4. Run `nix flake lock` to update lockfile

## Dev Shells

Defined in `nix/devShells.nix`:
```nix
# Available shells
nix develop           # default (pre-commit hooks)
nix develop .#ocaml   # OCaml 5.1
nix develop .#rust-wasm
nix develop .#nodejs22
nix develop .#bun
nix develop .#go
```

## Custom Packages

Packages in `nix/packages/` are discovered via `pkgs-by-name` convention:
```
nix/packages/<name>/default.nix → packages.<system>.<name>
```

## Overlays

Located in `nix/overlays/`:
- Applied globally via `inputs.self.nixpkgs.overlays`
- Include OCaml packages, Node packages, macOS apps, vim plugins
