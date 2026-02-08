# Code Style and Conventions

## Nix Code Style

### Formatting
- **Formatter**: `nixfmt-rfc-style` (RFC 166 compliant)
- Format all `.nix` files before committing

### Naming Conventions
- Use `camelCase` for local variables and function names
- Use descriptive names for module options
- Use `_` prefix for unused parameters (e.g., `_: { ... }`)

### Module Structure
```nix
{
  lib,
  inputs,
  ...
}:

{
  imports = [ ... ];
  
  # Configuration options
}
```

### Function Arguments
- Use attribute set destructuring for function arguments
- Include `...` for extensibility when appropriate
- Order: `lib`, `pkgs`, `inputs`, then others

### Examples from Codebase
```nix
# Good: Clear function with let bindings
mkNodeShell =
  name:
  let
    node = pkgs.${name};
    corepackShim = pkgs.nodeCorepackShims.overrideAttrs (_: {
      buildInputs = [ node ];
    });
  in
  pkgs.mkShell {
    description = "${name} Development Environment";
    buildInputs = [
      node
      corepackShim
    ];
  };
```

## Linting Tools
- **deadnix** - Finds unused Nix code (excludes `nix/overlays/nodePackages/node2nix`)
- **actionlint** - GitHub Actions workflow validation
- **shellcheck** - Shell script linting
- **stylua** - Lua formatting (for Neovim configs)

## Lua Code Style (Neovim)
- **Formatter**: `stylua`
- Follow standard Lua conventions

## OCaml/ReasonML (apps/)
- **Formatter**: `ocamlformat` via `dune build @fmt`
- Configure in `apps/rin.rocks/.ocamlformat`

## Git Conventions
- Commit messages should be descriptive
- Pre-commit hooks will run automatically on commit
