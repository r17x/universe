# Darwin Module Patterns

## Module Structure

All darwin modules live in `nix/modules/darwin/`. They are auto-discovered by ez-configs.

### Standard darwin module
```nix
{
  lib,
  config,
  pkgs,
  self,
  inputs,
  ...
}:

let
  cfg = config.universe.darwin.<name>;
in
{
  options.universe.darwin.<name> = {
    enable = lib.mkEnableOption "<description>";
  };

  config = lib.mkIf cfg.enable {
    # darwin-specific config
  };
}
```

### Configuration files

Darwin configurations live in `nix/configurations/darwin/`:
- `eR17.nix` — Base macOS config (aarch64-darwin)
- `eR17x.nix` — Extended: adds DNS, Tailscale, linux-builder

### Key darwin modules

Located in `nix/modules/darwin/`:
- System defaults, keyboard, trackpad
- Aerospace (tiling window manager)
- Homebrew (casks and formulae)
- Fonts
- GPG agent
- Network (DNS, firewall)
- Sketchybar (status bar)

## Launchd Services

### Daemon (runs as root)
```nix
launchd.daemons.<name> = {
  script = ''
    exec ${lib.getExe cfg.package}
  '';
  serviceConfig = {
    RunAtLoad = true;
    KeepAlive = true;
    StandardOutPath = "/var/log/<name>.log";
    StandardErrorPath = "/var/log/<name>.error.log";
  };
};
```

### User agent (runs as user)
```nix
launchd.user.agents.<name> = {
  command = "${lib.getExe cfg.package}";
  serviceConfig = {
    KeepAlive = true;
    ProcessType = "Interactive";
  };
};
```

### Low-priority background service
```nix
launchd.daemons.<name>.serviceConfig = {
  RunAtLoad = false;
  KeepAlive = false;
  Nice = 5;
  ProcessType = "Background";
  LowPriorityIO = true;
  ThrottleInterval = 10;
};
```

## System Defaults

```nix
system.defaults = {
  dock = {
    autohide = true;
    mru-spaces = false;
    show-recents = false;
  };
  finder = {
    AppleShowAllExtensions = true;
    FXEnableExtensionChangeWarning = false;
  };
  NSGlobalDomain = {
    AppleShowAllExtensions = true;
    InitialKeyRepeat = 15;
    KeyRepeat = 2;
  };
};
```

## Homebrew Integration

```nix
homebrew = {
  enable = true;
  onActivation.cleanup = "zap";
  casks = [
    "firefox"
    "discord"
  ];
  taps = [
    "homebrew/cask"
  ];
};
```

## Common Patterns

- Use `pkgs.stdenv.isDarwin` for platform checks
- Prefer nix packages over homebrew when available
- Use `lib.mkForce` sparingly for upstream overrides
- System activation via `system.activationScripts`
- Keyboard: `system.keyboard.enableKeyMapping = true`
