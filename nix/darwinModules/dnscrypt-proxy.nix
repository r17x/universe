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
      networksetup -setdnsservers Wi-Fi empty

      echo "checking dnscrypt-proxy configuration..." >&2 

      ${lib.getExe cfg.package} -check -config ${configFile}
    '';

    system.activationScripts.postActivation.text = ''
      echo  >&2 "checking dnscrypt-proxy service is listening on port 53..."

      # TODO: listen address and port soduld be get from configFile
      # toml read function should be implemented
      if nc -zv 127.0.0.1 53 2>&1 | grep -q succeeded; then
        networksetup -setdnsservers Wi-Fi 127.0.0.1
      fi
    '';

    launchd.daemons.dnscrypt-proxy = {
      path = [ config.environment.systemPath ];
      serviceConfig.ProcessType = "Interactive";
      serviceConfig.StandardOutPath = "/tmp/dnscrypt-proxy.out.log";
      serviceConfig.StandardErrorPath = "/tmp/dnscrypt-proxy.err.log";
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
