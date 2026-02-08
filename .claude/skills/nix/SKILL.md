---
name: nix
description: Nix flakes, nix-darwin, NixOS, and home-manager development assistance
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - Write
---

# Nix Development Skill

## Evaluation & Debugging

### Evaluate flake outputs
```bash
# List available outputs
nix flake show

# Evaluate specific attribute
nix eval .#<attribute> --json

# Darwin config options
nix eval .#darwinConfigurations.<host>.options.<path>

# Home-manager config
nix eval .#homeConfigurations."<user>@<host>".config.<path>
```

### Debug evaluation errors
```bash
# Show full trace
nix eval .#<attr> --show-trace

# Check flake validity
nix flake check

# Instantiate without building
nix-instantiate --eval -E '<expression>'
```

## Building & Rebuilding

### Darwin (macOS)
```bash
darwin-rebuild switch --flake .
darwin-rebuild switch --flake .#<hostname>

# Rollback
darwin-rebuild --list-generations
darwin-rebuild switch --rollback
```

### NixOS
```bash
sudo nixos-rebuild switch --flake .#<hostname>
sudo nixos-rebuild boot --flake .#<hostname>
```

### Home-manager standalone
```bash
home-manager switch --flake .#<user>@<host>
```

## Service Management (launchd/systemd)

### macOS launchd
```bash
# List services
launchctl list | grep -E "org.nixos|nix"

# Service status
launchctl print system/<label>
launchctl print gui/$(id -u)/<label>

# Control services
launchctl kickstart [-k] <domain>/<label>
launchctl kill SIGTERM <domain>/<label>
```

### Linux systemd
```bash
systemctl --user list-units --type=service
systemctl --user status <service>
systemctl --user restart <service>
journalctl --user -u <service> -f
```

## Launchd Configuration Options

For reducing CPU/IO priority in nix-darwin:
```nix
launchd.daemons.<name>.serviceConfig = {
  RunAtLoad = false;        # Don't start at boot
  KeepAlive = false;        # Don't auto-restart
  Nice = 5;                 # Lower CPU priority (1-20)
  ProcessType = "Background"; # Background scheduling
  LowPriorityIO = true;     # Lower I/O priority
  ThrottleInterval = 10;    # Min seconds between restarts
};

launchd.user.agents.<name>.serviceConfig = { /* same options */ };
```

## Common Patterns

### Override with mkForce
```nix
# When upstream sets a value you need to override
someOption = lib.mkForce false;
```

### Conditional by platform
```nix
# At Nix level (preferred)
serviceCommands = if pkgs.stdenv.isDarwin
  then import ./darwin.nix
  else import ./linux.nix;

# In module
config = lib.mkIf pkgs.stdenv.isDarwin { ... };
```

### Module structure
```nix
{ lib, config, pkgs, ... }:
let
  cfg = config.myModule;
in {
  options.myModule = {
    enable = lib.mkEnableOption "my module";
  };

  config = lib.mkIf cfg.enable {
    # implementation
  };
}
```

## Flake Inputs Management

```bash
# Update all inputs
nix flake update

# Update specific input
nix flake lock --update-input <input-name>

# Show inputs
nix flake metadata
```

## Troubleshooting

### "infinite recursion" error
- Check for circular dependencies in imports
- Use `lib.mkDefault` or `lib.mkForce` to resolve conflicts

### "attribute not found"
- Verify the attribute path with `nix eval`
- Check if module is properly imported

### Service not starting
- Check plist/unit file generation
- Verify paths in ProgramArguments
- Check logs for errors
