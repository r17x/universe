# Cross-Platform Module Patterns

## Overview

Cross-platform modules live in `nix/modules/cross/` and are shared across darwin, NixOS, and home-manager configurations.

## Module Structure

```nix
{ lib, config, pkgs, ... }:

let
  cfg = config.universe.cross.<name>;
in
{
  options.universe.cross.<name> = {
    enable = lib.mkEnableOption "<description>";
  };

  config = lib.mkIf cfg.enable {
    # Platform-agnostic configuration
  };
}
```

## Platform Conditionals

### In module config
```nix
config = lib.mkIf cfg.enable (lib.mkMerge [
  {
    # Common to all platforms
  }
  (lib.mkIf pkgs.stdenv.isDarwin {
    # macOS only
  })
  (lib.mkIf pkgs.stdenv.isLinux {
    # Linux only
  })
]);
```

### Conditional imports
```nix
imports = lib.optionals pkgs.stdenv.isDarwin [
  ./darwin-specific.nix
] ++ lib.optionals pkgs.stdenv.isLinux [
  ./linux-specific.nix
];
```

### Conditional packages
```nix
environment.systemPackages = with pkgs; [
  common-package
] ++ lib.optionals pkgs.stdenv.isDarwin [
  darwin-only-package
] ++ lib.optionals pkgs.stdenv.isLinux [
  linux-only-package
];
```

## Common Cross Modules

Located in `nix/modules/cross/`:
- **Nix settings** — `nix.settings`, experimental features, substituters
- **Nixpkgs config** — `nixpkgs.config.allowUnfree`, overlays
- **Fish shell** — Cross-platform shell configuration

## Nix Settings Pattern

```nix
{
  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      trusted-users = [ "root" "@wheel" ];
      substituters = [
        "https://cache.nixos.org"
      ];
      trusted-public-keys = [
        "cache.nixos.org-1:..."
      ];
    };
    gc = {
      automatic = true;
      options = "--delete-older-than 30d";
    };
  };
}
```

## Best Practices

- Keep cross modules truly platform-agnostic in the common section
- Use `lib.mkMerge` for platform-specific overrides
- Test on both darwin and NixOS (or at minimum, eval both configs)
- Prefer `pkgs.stdenv.isDarwin` over `builtins.currentSystem`
