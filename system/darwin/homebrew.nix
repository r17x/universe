{ config, lib, pkgs, ... }:

let
  inherit (lib) mkIf;
  # mkIfCaskPresent = cask: mkIf (lib.any (x: x.name == cask) config.homebrew.casks);
  brewEnabled = config.homebrew.enable;
in
{
  environment.shellInit = mkIf brewEnabled ''
    eval "$(${config.homebrew.brewPrefix}/brew shellenv)"
  '';

  system.activationScripts.preUserActivation.text = mkIf brewEnabled ''
    if [ ! -f ${config.homebrew.brewPrefix}/brew ]; then
      ${pkgs.bash}/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
  '';


  homebrew.enable = true;
  homebrew.onActivation.cleanup = "zap";
  homebrew.global.brewfile = true;

  homebrew.masApps = {
    Vimari = 1480933944;
    WhatsApp = 1147396723;
    "SpeakerAmp:Booster & Equalizer" = 1496955576;
  };

  homebrew.casks = [
    "firefox"
    "google-chrome"
    "raycast"
  ];

}
