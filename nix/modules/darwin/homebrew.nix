{
  config,
  lib,
  ...
}:

let
  inherit (lib) mkIf;
  brewEnabled = config.homebrew.enable;
in
{
  environment.shellInit =
    mkIf brewEnabled # bash
      ''
        eval "$(${config.homebrew.brewPrefix}/brew shellenv)"
      '';

  homebrew.enable = true;
  homebrew.brews = [ ];
  homebrew.onActivation.cleanup = "zap";
  homebrew.global.brewfile = true;

  homebrew.masApps = {
    Vimari = 1480933944;
    WhatsApp = 310633997;
  };

  homebrew.casks = [ ];

}
