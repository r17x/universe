{
  config,
  lib,
  pkgs,
  ...

}:

with lib;

let
  cfg = config.services.yggdrasil;
in

{
  options.services.yggdrasil = {
    enable = mkOption {
      type = types.bool;
      default = false;
      description = "Whether to enable the yggdrasil service.";
    };
    package = mkOption {
      type = types.path;
      default = pkgs.yggdrasil;
      defaultText = "pkgs.yggdrasil";
      description = "This option specifies the yggdrasil package to use";
    };
    settings = mkOption {
      type = types.string;
      description = ''
        This option specifies the yggdrasil settings to use
        More details can be found at https://yggdrasil-network.github.io/configuration/
      '';
    };
  };

  config = mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];
    launchd.daemons.yggdrasil = {
      script = ''
        ${lib.getExe' cfg.package "yggdrasil"} -useconffile ${(toString (pkgs.writeText "yggdrasil.conf" cfg.settings))}
      '';
      serviceConfig = {
        RunAtLoad = true;
        KeepAlive = true;
      };
    };
  };
}
