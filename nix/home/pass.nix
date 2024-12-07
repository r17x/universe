{
  lib,
  config,
  pkgs,
  ...
}:

with lib;

let
  cfg = config.home.user-info.within.gpg;
in
{
  options.within.pass.enable = mkEnableOption "Enables Within's pass config";

  config = mkIf cfg.enable {
    home.packages = [ pkgs.gnupg ];

    programs.password-store = {
      enable = cfg.enable;
      package = pkgs.pass.withExtensions (p: [
        p.pass-otp
        p.pass-checkup
        p.pass-audit
        p.pass-update
      ]);
    };

    programs.browserpass = {
      enable = cfg.enable;
      browsers = [ "firefox" ];
    };
  };
}
