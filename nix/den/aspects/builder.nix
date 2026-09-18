{ ... }:
{
  den.aspects.builder =
    { host, ... }:
    {
      darwin =
        {
          lib,
          pkgs,
          config,
          ...
        }:

        let
          cfg = config.nix.linux-builder;
          builder = host.builder;
        in
        {
          nix.linux-builder.enable = true;

          nix.settings.trusted-users = lib.mkIf cfg.enable [
            "@admin"
            builder.trustedUser
            "root"
          ];
          nix.settings.builders-use-substitutes = cfg.enable;

          launchd.daemons.linux-builder.serviceConfig = lib.mkIf cfg.enable {
            RunAtLoad = lib.mkForce false;
            KeepAlive = lib.mkForce false;
          };

          nix.linux-builder = {
            ephemeral = true;
            maxJobs = builder.maxJobs;
            systems = builder.systems;
            config = {
              system.stateVersion = lib.mkForce "25.11";
              users.users.root.openssh.authorizedKeys.keys = builder.authorizedKeys;
              environment.systemPackages = with pkgs; [
                nixos-rebuild
              ];
              boot.binfmt.emulatedSystems = [ "x86_64-linux" ];
              virtualisation = {
                darwin-builder = {
                  diskSize = builder.diskSize;
                  memorySize = builder.memorySize;
                };
                cores = builder.cores;
              };
              networking.hostName = "vm";
              nix.settings.sandbox = false;
              nix.settings.experimental-features = [
                "flakes"
                "nix-command"
              ];
              nix.settings.substituters = lib.mapAttrsToList (_: c: c.url) builder.caches;
              nix.settings.trusted-public-keys = lib.mapAttrsToList (_: c: c.key) builder.caches;

              zramSwap = {
                enable = true;
                memoryPercent = 50;
                algorithm = "zstd";
                priority = 100;
              };
              swapDevices = [
                {
                  device = "/var/lib/swapfile";
                  size = 4 * 1024;
                  priority = 10;
                }
              ];
              boot.kernel.sysctl."vm.swappiness" = 100;

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
        };
    };
}
