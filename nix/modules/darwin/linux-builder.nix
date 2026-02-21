{
  self,
  lib,
  pkgs,
  config,
  ...
}:

with lib;

let
  cfg = config.nix.linux-builder;
in

{
  nix.settings.trusted-users = mkIf cfg.enable [
    "@admin"
    "r17"
    "root"
  ];
  nix.settings.builders-use-substitutes = cfg.enable;

  # Disable auto-start to reduce CPU spike during rebuild
  # Start manually with: universe service start linux-builder
  launchd.daemons.linux-builder.serviceConfig = mkIf cfg.enable {
    RunAtLoad = mkForce false;
    KeepAlive = mkForce false;
  };

  nix.linux-builder = {
    ephemeral = true;
    maxJobs = 4;
    systems = [
      "x86_64-linux"
      "aarch64-linux"
    ];
    config = {
      system.stateVersion = lib.mkForce "25.11";
      users.users.root.openssh.authorizedKeys.keys = self.users.r17.keys;
      environment.systemPackages = with pkgs; [
        nixos-rebuild
      ];
      boot.binfmt.emulatedSystems = [ "x86_64-linux" ];
      virtualisation = {
        darwin-builder = {
          diskSize = 40 * 1024;
          memorySize = 8 * 1024;
        };
        cores = 6;
      };
      networking.hostName = "vm";
      nix.settings.sandbox = false;
      nix.settings.experimental-features = [
        "flakes"
        "nix-command"
      ];

      # Swap: zram (primary) + swapfile (fallback) for memory-intensive builds
      zramSwap = {
        enable = true;
        memoryPercent = 50; # 4GB zram (~12GB effective with compression)
        algorithm = "zstd";
        priority = 100;
      };
      swapDevices = [
        {
          device = "/var/lib/swapfile";
          size = 4 * 1024; # 4GB fallback
          priority = 10;
        }
      ];
      boot.kernel.sysctl."vm.swappiness" = 100;

      # Increase file descriptor limits for large builds
      security.pam.loginLimits = [
        {
          domain = "*";
          type = "soft";
          item = "nofile";
          value = "524288";
        }
        {
          domain = "*";
          type = "hard";
          item = "nofile";
          value = "524288";
        }
      ];
    };
  };
}
