{ config, pkgs, lib, ... }:

{
  home.sessionVariables = {
    EDITOR = "nvim";
  };

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;

  imports = [
    ./packages.nix
    ./shells.nix
  ];
}
