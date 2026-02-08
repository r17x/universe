---
name: nix-service
description: Manage nix-managed launchd and systemd services
allowed-tools:
  - Bash
  - Read
---

# Nix Service Management

## macOS (launchd)

### Discovery
```bash
# List nix-managed services
launchctl list | grep -E "org.nixos|nix"

# System daemons
ls /Library/LaunchDaemons/org.nixos.*.plist

# User agents
ls ~/Library/LaunchAgents/org.nixos.*.plist
```

### Service Control
```bash
# Domain format: system/<label> or gui/<uid>/<label>
DOMAIN="system/org.nixos.<name>"
DOMAIN="gui/$(id -u)/org.nixos.<name>"

# Status
launchctl print $DOMAIN

# Start/restart
launchctl kickstart $DOMAIN
launchctl kickstart -k $DOMAIN  # kill first

# Stop (graceful)
launchctl kill SIGTERM $DOMAIN

# Stop (force unload - careful!)
sudo launchctl bootout $DOMAIN
```

### View Plist
```bash
cat /Library/LaunchDaemons/org.nixos.<name>.plist
plutil -p /Library/LaunchDaemons/org.nixos.<name>.plist
```

### Logs
```bash
# Recent logs for service
log show --predicate 'subsystem == "org.nixos.<name>"' --last 5m

# Stream logs
log stream --predicate 'process == "<process-name>"'
```

## Linux (systemd)

### Discovery
```bash
# System services
systemctl list-units --type=service | grep nix

# User services
systemctl --user list-units --type=service
```

### Service Control
```bash
# Status
systemctl [--user] status <service>

# Control
systemctl [--user] start <service>
systemctl [--user] stop <service>
systemctl [--user] restart <service>

# Enable/disable at boot
systemctl [--user] enable <service>
systemctl [--user] disable <service>
```

### Logs
```bash
journalctl [-u <service>] [-f] [--user]
```

## Nix Configuration

### Reduce CPU priority (darwin)
```nix
launchd.user.agents.<name>.serviceConfig = {
  ProcessType = "Background";
  Nice = 5;
  LowPriorityIO = true;
};
```

### Disable auto-start (darwin)
```nix
launchd.daemons.<name>.serviceConfig = {
  RunAtLoad = lib.mkForce false;
  KeepAlive = lib.mkForce false;
};
```

### Override existing service
Use `lib.mkForce` when the service module already sets values.
