{
  lib,
  config,
  pkgs,
  ...
}:

let

  cfg =
    config.services.komodo or {
      enable = false;
      package = pkgs.runCommand "komodo" { } '''';
      settings = {
        core = { };
        periphery = { };
      };
    };

  format = pkgs.formats.toml { };

  coreOptions = lib.mkOption {
    type = format.type;
    description = ''
      This option specifies the komodo core settings to use

      Komodo Core is a web server hosting the Core API and browser UI. All user interaction with the connected servers flow through the Core.

      More details can be found at https://github.com/moghtech/komodo/blob/v${cfg.package.version}/config/core.config.toml 
    '';
  };

  peripheryOptions = lib.mkOption {
    type = format.type;
    description = ''
      This option specifies the komodo periphery settings to use

      Komodo Periphery is a small stateless web server that runs on all connected servers. It exposes an API called by Komodo Core to perform actions on the server, get system usage, and container status / logs. It is only intended to be reached from the core, and has an address whitelist to limit the IPs allowed to call this API.

      More details can be found at https://github.com/moghtech/komodo/blob/v${cfg.package.version}/config/periphery.config.toml 
    '';
  };

in

{
  options = {
    services.komodo = {
      enable = lib.mkEnableOption "komodo";
      package = lib.mkPackageOption pkgs "komodo" { };
      settings = lib.mkOption {
        default = {
          core = { };
          periphery = { };
        };
        type = lib.types.submodule {
          options = {
            core = coreOptions;
            periphery = peripheryOptions;
          };
        };
        description = ''
          This option specifies the komodo settings to use
          More details can be found at
        '';
      };
    };
  };

  config = lib.mkIf cfg.enable {

    environment.systemPackages = [ cfg.package ];

    users.users.komodo = {
      isNormalUser = true;
      home = "/var/lib/komodo";
      createHome = true;
      description = "Komodo user";
      extraGroups = [
        "docker"
        "komodo"
      ];
    };

    systemd.services.komodo-core = {
      description = "Core API and browser UI";
      after = [ "network.target" ];
      wantedBy = [ "default.target" ];
      serviceConfig = {
        ExecStart = "${lib.getExe' cfg.package "core"} --config ${format.generate "core.config.toml" cfg.settings.core}";
        Restart = "on-failure";
        TimeoutStartSec = 0;
      };
    };

    systemd.services.periphery-agent = {
      description = "Agent to connect with Komodo Core";
      after = [ "network.target" ];
      wantedBy = [ "default.target" ];
      serviceConfig = {
        ExecStart = "${lib.getExe' cfg.package "periphery"} --config ${format.generate "periphery.config.toml" cfg.settings.periphery}";
        Restart = "on-failure";
        TimeoutStartSec = 0;
      };
    };
  };
}
