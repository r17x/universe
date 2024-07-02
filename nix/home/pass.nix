{ lib, config, pkgs, ... }:

with lib;

let
  inherit (config.home.user-info) within;

  cfg = within.gpg;
in
{
  options.within.pass.enable = mkEnableOption "Enables Within's pass config";

  config = mkIf cfg.enable {
    programs.password-store.enable = true;
    programs.password-store.package = pkgs.pass.withExtensions (p: [ p.pass-otp p.pass-checkup p.pass-audit p.pass-update ]);
    programs.browserpass.enable = true;
    programs.browserpass.browsers = [ "firefox" ];
  };
}

