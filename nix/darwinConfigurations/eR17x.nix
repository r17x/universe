{
  inputs,
  lib,
  pkgs,
  ezModules,
  ...
}:

{
  imports = lib.attrValues (ezModules // inputs.self.nixosModules);

  system.stateVersion = 4;
  nixpkgs.hostPlatform = "aarch64-darwin";

  users.users.r17 = {
    home = "/Users/r17";
    shell = pkgs.fish;
  };

  # --- see: nix/nixosModules/nix.nix
  nix-settings = {
    enable = true;
    use = "full";
    inputs-to-registry = true;
  };

  # --- see: nix/darwinModules/mouseless.nix
  mouseless.enable = true;
  mouseless.wm = "aerospace";

  # --- nix-darwin
  homebrew.enable = true;

  networking.hostName = "eR17x";
  networking.computerName = "eR17x";

  nix.settings.trusted-users = [ "@admin" ];
  nix.settings.builders-use-substitutes = true;
  nix.linux-builder = {
    enable = true;
    ephemeral = true;
    maxJobs = 4;
    config = {
      virtualisation = {
        darwin-builder = {
          diskSize = 40 * 1024;
          memorySize = 8 * 1024;
        };
        cores = 6;
      };
      nix.settings.sandbox = false;
      users.users.root.openssh.authorizedKeys.keys = inputs.self.users.r17.keys;
    };
  };
}
