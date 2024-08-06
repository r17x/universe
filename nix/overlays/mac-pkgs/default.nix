{ ... }:
{
  flake.overlays.macos =
    _final: prev:
    let
      inherit (prev.lib) attrsets;
      callPackage = prev.newScope { };
      packages = [
        "xbar"
        # "obs-studio"
        "orbstack"
        "telegram"
        "iriun-webcam"
        "clipy"
        # "googlechrome" # see system/darwin/homebrew.nix
      ];
    in

    attrsets.genAttrs packages (name: callPackage ./${name}.nix { })
    // {
      sbar_menus = prev.callPackage ../../nixosModules/darwin/sketchybar/helpers/menus { };
      sbar_events = prev.callPackage ../../nixosModules/darwin/sketchybar/helpers/event_providers { };
      sbarLua = prev.callPackage ../../nixosModules/darwin/sketchybar/helpers/sbar.nix { };
      sketchybarConfigLua = prev.callPackage ../../nixosModules/darwin/sketchybar { };
    };
}
