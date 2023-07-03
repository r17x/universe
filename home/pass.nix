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
    programs.password-store.package = pkgs.pass.withExtensions (p: [ p.pass-otp ]);

  };
}

