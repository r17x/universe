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

  mouseless.enable = true;
  mouseless.wm = "aerospace";
  homebrew.enable = true;

  networking.hostName = "eR17";
  networking.computerName = "eR17";
}
