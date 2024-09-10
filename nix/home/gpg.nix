{
  lib,
  config,
  pkgs,
  ...
}:

let
  cfg = config.home.user-info.within.gpg;
in
{
  options.within.gpg.enable = lib.mkEnableOption "Enables Within's gpg config";

  config = lib.mkIf cfg.enable {
    programs.gpg = {
      enable = cfg.enable;
      settings = {
        use-agent = true;
      };
    };

    home.file = lib.attrsets.optionalAttrs pkgs.stdenv.isDarwin {
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
