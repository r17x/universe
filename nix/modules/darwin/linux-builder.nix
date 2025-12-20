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
  nix.settings.trusted-users = mkIf cfg.enable [ "@admin" ];
  nix.settings.builders-use-substitutes = cfg.enable;
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
    };
  };
}
