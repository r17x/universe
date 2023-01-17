_final: prev:

let
  inherit (prev.lib) attrsets;
  callPackage = prev.newScope { };
  packages = [
    "xbar"
    "obs-studio"
    "telegram"
    "iriun-webcam"
    "clipy"
    # "googlechrome" # see system/darwin/homebrew.nix
  ];
in

attrsets.genAttrs packages (name: callPackage ./${name}.nix { })
