{
  lib,
  pkgs,
  ezModules,
  crossModules,
  config,
  ...
}:

{
  imports = lib.attrValues (ezModules // crossModules);

  system.stateVersion = 4;
  nixpkgs.hostPlatform = "aarch64-darwin";

  system.primaryUser = "r17";

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

  networking = {
    hostName = lib.mkDefault "eR17";
    computerName = config.networking.hostName;
  };
}
