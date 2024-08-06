{
  lib,
  config,
  pkgs,
  ...
}:

with lib;

let
  inherit (config.home.user-info) within;
  inherit (pkgs.stdenv) isDarwin;

  cfg = within.gpg;
in
{
  options.within.gpg.enable = mkEnableOption "Enables Within's gpg config";

  config = mkIf cfg.enable {
    programs.gpg = {
      enable = cfg.enable;
      settings = {
        use-agent = true;
      };
    };

    home.file = attrsets.optionalAttrs isDarwin {
      ".gnupg/gpg-agent.conf".source = pkgs.writeTextFile {
        name = "home-gpg-agent.conf";
        text = # toml
          ''
            pinentry-program ${pkgs.pinentry_mac}/Applications/pinentry-mac.app/Contents/MacOS/pinentry-mac
          '';
      };
    };

  };
}
