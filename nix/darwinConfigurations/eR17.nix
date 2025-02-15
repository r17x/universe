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

  networking.hostName = "eR17";
  networking.computerName = "eR17";
}
