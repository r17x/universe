{
  lib,
  config,
  pkgs,
  ezModules,
  crossModules,
  ...
}:

{
  imports = lib.attrValues (ezModules // crossModules);

  system.stateVersion = 4;
  nixpkgs.hostPlatform = "aarch64-darwin";

  system.primaryUser = lib.mkDefault "r17";

  users.users.${config.system.primaryUser} = {
    home = "/Users/${config.system.primaryUser}";
    shell = lib.mkDefault pkgs.fish;
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
    computerName = config.networking.hostName;
  };
}
