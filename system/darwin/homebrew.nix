{ config, lib, ... }:

let
  inherit (lib) mkIf;
  # mkIfCaskPresent = cask: mkIf (lib.any (x: x.name == cask) config.homebrew.casks);
  brewEnabled = config.homebrew.enable;
in
{
  environment.shellInit = mkIf brewEnabled ''
    eval "$(${config.homebrew.brewPrefix}/brew shellenv)"
  '';


  homebrew.enable = true;
  homebrew.onActivation.cleanup = "zap";
  homebrew.global.brewfile = true;

  homebrew.masApps = {
    Vimari = 1480933944;
    WhatsApp = 1147396723;
  };

}
