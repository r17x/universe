{ ... }:
{
  den.aspects.builder =
    { user, ... }:
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
        in
        {
          nix.settings.trusted-users = lib.mkIf cfg.enable [
            "@admin"
            user.userName
            "root"
          ];
          nix.settings.builders-use-substitutes = cfg.enable;

          launchd.daemons.linux-builder.serviceConfig = lib.mkIf cfg.enable {
            RunAtLoad = lib.mkForce false;
            KeepAlive = lib.mkForce false;
          };

          nix.linux-builder = {
            ephemeral = true;
            maxJobs = user.builder.maxJobs;
            systems = user.builder.systems;
            config = {
              system.stateVersion = lib.mkForce "25.11";
              users.users.root.openssh.authorizedKeys.keys = user.keys;
              environment.systemPackages = with pkgs; [
                nixos-rebuild
              ];
              boot.binfmt.emulatedSystems = [ "x86_64-linux" ];
              virtualisation = {
                darwin-builder = {
                  diskSize = user.builder.diskSize;
                  memorySize = user.builder.memorySize;
                };
                cores = user.builder.cores;
              };
              networking.hostName = "vm";
              nix.settings.sandbox = false;
              nix.settings.experimental-features = [
                "flakes"
                "nix-command"
              ];
              nix.settings.substituters = lib.mapAttrsToList (_: c: c.url) user.caches;
              nix.settings.trusted-public-keys = lib.mapAttrsToList (_: c: c.key) user.caches;

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
