# Codebase Structure

```
.
├── flake.nix           # Main flake entry point
├── flake.lock          # Lock file for inputs
├── .envrc              # direnv configuration (uses `use flake .#ocaml`)
├── .pre-commit-config.yaml  # Generated pre-commit config
├── .sops.yaml          # SOPS secret configuration
│
├── nix/                # Core Nix configurations
│   ├── default.nix     # Main module imports and flake configuration
│   ├── devShells.nix   # Development environment definitions
│   ├── colors.nix      # Color scheme definitions
│   ├── icons.nix       # Icon definitions
│   │
│   ├── configurations/ # Platform-specific configurations
│   │   ├── darwin/     # macOS configurations
│   │   │   ├── eR17.nix   # Primary Darwin config
│   │   │   └── eR17x.nix  # Extended Darwin config (with linux-builder)
│   │   ├── home/       # Home-manager configurations
│   │   │   └── r17.nix    # User r17x configuration
│   │   └── nixos/      # NixOS configurations
│   │       └── vm.nix     # VM configuration
│   │
│   ├── modules/        # Reusable modules
│   │   ├── cross/      # Cross-platform modules
│   │   ├── darwin/     # Darwin-specific modules
│   │   │   └── mouseless.nix  # Tiling WM setup (yabai/aerospace, skhd, sketchybar)
│   │   ├── home/       # Home-manager modules
│   │   ├── nixos/      # NixOS-specific modules
│   │   └── flake/      # Flake-specific modules
│   │       ├── universe.nix   # Universe CLI tool
│   │       └── universe/      # Platform-specific implementations
│   │           ├── service-darwin.nix  # macOS launchctl service management
│   │           └── service-linux.nix   # Linux systemctl service management
│   │
│   ├── overlays/       # Nixpkgs overlays
│   │   ├── macOS packages
│   │   ├── OCaml packages
│   │   ├── Node packages
│   │   └── Vim utilities
│   │
│   ├── packages/       # Custom packages
│   └── nvim.nix/       # Neovim configuration (nixvim-based)
│
├── apps/               # Custom applications
│   ├── norg/           # OCaml CLI application
│   ├── rin.rocks/      # ReasonML web application
│   └── evilfactory/    # OCaml application
│
├── secrets/            # Encrypted secrets (SOPS)
├── notes/              # Personal knowledge base (.norg format)
└── data/               # Database service data
```

## Key Configuration Patterns
- **ez-configs** is used to automatically discover and wire configurations
- Darwin hosts are defined in `nix/default.nix` under `ezConfigs.darwin.hosts`
- Home modules are automatically loaded from `nix/modules/home/`
- Overlays are loaded from `nix/overlays/` and applied globally
