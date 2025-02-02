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

  configFile =
    if isPath cfg.settings then
      (cfg.settings |> builtins.readFile |> pkgs.writeText "dnscrypt-proxy.toml" |> toString)
    else
      format.generate "dnscrypt-proxy.toml" cfg.settings;

in
{
  options = {
    services.dnscrypt-proxy.enable = mkOption {
      type = types.bool;
      default = false;
      description = "Whether to enable the dnscrypt-proxy service.";
    };

    services.dnscrypt-proxy.package = mkOption {
      type = types.path;
      default = pkgs.dnscrypt-proxy2;
      defaultText = "pkgs.dnscrypt-proxy2";
      description = "This option specifies the dnscrypt-proxy package to use";
    };

    services.dnscrypt-proxy.settings = mkOption {
      type = types.oneOf [
        types.path
        format.type
      ];
      description = ''
        This option specifies the dnscrypt-proxy settings to use

        More details can be found at https://github.com/DNSCrypt/dnscrypt-proxy/blob/master/dnscrypt-proxy/example-dnscrypt-proxy.toml
      '';
    };

  };

  config = mkIf cfg.enable {
    system.activationScripts.preActivation.text = ''
      echo "checking dnscrypt-proxy configuration..." >&2 

      ${lib.getExe cfg.package} -check -config ${configFile}
    '';

    launchd.daemons.dnscrypt-proxy = {
      path = [ config.environment.systemPath ];
      serviceConfig = {
        RunAtLoad = true;
        KeepAlive = true;
        ProgramArguments = [
          "${lib.getExe cfg.package}"
          "-config"
          configFile
        ];
      };
    };
  };

}
