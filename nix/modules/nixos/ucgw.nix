{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.ucgw;
  settingsFormat = pkgs.formats.toml { };
  configFile = settingsFormat.generate "ucgw.toml" cfg.settings;
in
{
  options.services.ucgw = {
    enable = lib.mkEnableOption "USB Cellular Gateway";

    package = lib.mkPackageOption pkgs "ucgw" { };

    settings = lib.mkOption {
      type = settingsFormat.type;
      default = { };
      description = "ucgw configuration (rendered to TOML)";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.ucgw = {
      description = "USB Cellular Tethering Gateway";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        ExecStart = "${cfg.package}/bin/gw-daemon ${configFile}";
        Restart = "on-failure";
        RestartSec = 5;

        AmbientCapabilities = [
          "CAP_NET_ADMIN"
          "CAP_NET_RAW"
        ];
        CapabilityBoundingSet = [
          "CAP_NET_ADMIN"
          "CAP_NET_RAW"
        ];

        DynamicUser = false;

        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        NoNewPrivileges = true;

        Type = "notify";
        NotifyAccess = "main";
      };
    };
  };
}
