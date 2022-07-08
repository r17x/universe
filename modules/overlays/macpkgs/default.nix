{ system ? builtins.currentSystem
, pkgs ? import <nixpkgs> {
    inherit system;
  }
, attrsets
,
}:


let
  packages = [
    "rectangle"
    "xbar"
    "obs-studio"
    "telegram"
    "iriun-webcam"
    "clipy"
  ];
in
attrsets.genAttrs packages (name: pkgs.callPackage ./${name}.nix { })
