{
  config,
  lib,
  pkgs,
  ...
}:

with lib;

let
  cfg = config.services.dnscrypt-proxy;

  format = pkgs.formats.toml { };

  configFile = format.generate "dnscrypt-proxy.toml" cfg.settings;

in
{
  options.services.dnscrypt-proxy = {
    enable = mkOption {
      type = types.bool;
      default = false;
      description = "Whether to enable the dnscrypt-proxy service.";
    };

    package = mkOption {
      type = types.path;
      default = pkgs.dnscrypt-proxy2;
      defaultText = "pkgs.dnscrypt-proxy2";
      description = "This option specifies the dnscrypt-proxy package to use";
    };

    settings = mkOption {
      type = format.type;
      description = ''
        This option specifies the dnscrypt-proxy settings to use

        More details can be found at https://github.com/DNSCrypt/dnscrypt-proxy/blob/master/dnscrypt-proxy/example-dnscrypt-proxy.toml
      '';
    };

    overrideLocalDns = mkOption {
      type = types.bool;
      default = false;
      description = ''
        This options specifies whether to override the local DNS settings with the listen_addresses from the dnscrypt-proxy configuration.
      '';
    };
  };

  config = mkIf cfg.enable {
    networking.dns = mkIf cfg.overrideLocalDns (
      lib.concatMap (lib.strings.match ''^(\[?[0-9a-fA-F:.]+]?):[0-9]+$'') (
        cfg.settings.listen_addresses or [ ]
      )
    );

    launchd.daemons.dnscrypt-proxy = {
      script = ''
        ${lib.getExe' cfg.package "dnscrypt-proxy"} -config ${configFile}
      '';
      serviceConfig = {
        RunAtLoad = true;
        KeepAlive = true;
      };
    };
  };

}
