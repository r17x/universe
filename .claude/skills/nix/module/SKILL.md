---
name: nix-module
description: Create and structure Nix modules for darwin, NixOS, or home-manager
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

# Nix Module Development

## Module Template

```nix
{ lib, config, pkgs, ... }:

let
  cfg = config.<namespace>.<name>;
in
{
  options.<namespace>.<name> = {
    enable = lib.mkEnableOption "<description>";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.<package>;
      description = "Package to use";
    };

    settings = lib.mkOption {
      type = lib.types.attrs;
      default = {};
      description = "Configuration settings";
    };
  };

  config = lib.mkIf cfg.enable {
    # Implementation here
  };
}
```

## Common Option Types

```nix
lib.types.bool
lib.types.str
lib.types.int
lib.types.path
lib.types.package
lib.types.listOf lib.types.str
lib.types.attrsOf lib.types.str
lib.types.nullOr lib.types.str
lib.types.enum [ "a" "b" "c" ]
lib.types.submodule { options = { ... }; }
```

## Module Patterns

### Platform-specific config
```nix
config = lib.mkIf cfg.enable (lib.mkMerge [
  {
    # Common config
  }
  (lib.mkIf pkgs.stdenv.isDarwin {
    # macOS only
  })
  (lib.mkIf pkgs.stdenv.isLinux {
    # Linux only
  })
]);
```

### Import platform modules
```nix
let
  platformModule = if pkgs.stdenv.isDarwin
    then ./darwin.nix
    else ./linux.nix;
in {
  imports = [ platformModule ];
}
```

### Conditional imports
```nix
imports = lib.optional cfg.enableFeatureX ./feature-x.nix;
```

## Darwin-specific

### Launchd daemon
```nix
launchd.daemons.<name> = {
  script = ''
    exec ${lib.getExe cfg.package}
  '';
  serviceConfig = {
    RunAtLoad = true;
    KeepAlive = true;
  };
};
```

### Launchd user agent
```nix
launchd.user.agents.<name> = {
  command = "${lib.getExe cfg.package}";
  serviceConfig.KeepAlive = true;
};
```

## Home-manager specific

### XDG config file
```nix
xdg.configFile."<app>/config".text = ''
  # config content
'';
```

### Program module
```nix
programs.<name> = {
  enable = true;
  package = cfg.package;
  settings = cfg.settings;
};
```

## Best Practices

1. Use `lib.mkEnableOption` for enable flags
2. Use `lib.mkDefault` for overridable defaults
3. Use `lib.mkForce` sparingly, only when necessary
4. Keep modules focused on single responsibility
5. Document options with `description`
6. Use `lib.getExe` for binary paths
