{ inputs, ... }:

{
  imports = [
    inputs.home-manager.darwinModules.home-manager
  ];
  home-manager.backupFileExtension = ".backup-before-nix-home-manager";
  home-manager.useGlobalPkgs = true;
  home-manager.useUserPackages = true;
}
