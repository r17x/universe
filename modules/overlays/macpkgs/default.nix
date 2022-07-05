{
  system ? builtins.currentSystem,
  pkgs ? import <nixpkgs> {
    inherit system;
  },
}:

{
  rectangle = pkgs.callPackage ./rectangle.nix {};
  xbar = pkgs.callPackage ./xbar.nix {};
}
