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
      extraUsers = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "Extra users to create for komodo";
      };
      workDir = lib.mkOption {
        type = lib.types.str;
        default = "/var/lib/komodo";
        description = "The working directory for komodo";
      };
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

    users.users._komodo = {
      uid = lib.mkDefault 666;
      name = "_komodo";
      home = cfg.workDir;
      createHome = true;
      description = "Komodo user";
      isHidden = true;
    };

    users.groups._komodo = {
      gid = lib.mkDefault 669;
      name = "_komodo";
      members = [ "_komodo" ] ++ cfg.extraUsers;
    };

    users.knownUsers = [ "_komodo" ];
    users.knownGroups = [ "_komodo" ];

    environment.etc."komodo/config/config.toml".source =
      format.generate "core.config.toml" cfg.settings.core;

    launchd.daemons.komodo-ferretdb = {
      serviceConfig = {
        KeepAlive = true;
        RunAtLoad = true;
        WorkingDirectory = cfg.workDir;
        StandardOutPath = "${cfg.workDir}/db.log";
        StandardErrorPath = "${cfg.workDir}/db.log";
        UserName = "_komodo";
        EnvironmentVariables = {
          HOME = cfg.workDir;
          FERRETDB_STATE_DIR = "${cfg.workDir}/state";
          FERRETDB_SQLITE_URL = "file:${cfg.workDir}/state/";
          FERRETDB_AUTH = "disabled";
          FERRETDB_HANDLER = "sqlite";
        };
        ProgramArguments = [
          "${lib.getExe' pkgs.ferretdb "ferretdb"}"
        ];
      };

      # script = ''
      #   ${lib.getExe' cfg.package "core"} --config ${format.generate "core.config.toml" cfg.settings.core}
      # '';

    };
    # format.generate "core.config.toml" cfg.settings.core;
    # environment."${cfg.workDir}/periphery.config.toml".source =
    #   format.generate "periphery.config.toml" cfg.settings.periphery;
    system.activationScripts.launchd.text = lib.mkBefore ''
      echo >&2 "Setting up Komodo configuration files"

      for d in "state" "config"; do
        if [ -d ${cfg.workDir}/$d ]; then
          echo >&2 "Directory ${cfg.workDir}/$d already exists"
          continue
        fi
        ${lib.getExe' pkgs.coreutils "mkdir"} -p ${cfg.workDir}/$d
        ${lib.getExe' pkgs.coreutils "chown"} -R _komodo:_komodo ${cfg.workDir}/$d
      done
    '';

    launchd.daemons.komodo-core = {
      serviceConfig = {
        KeepAlive = true;
        RunAtLoad = true;
        WorkingDirectory = cfg.workDir;
        StandardOutPath = "${cfg.workDir}/core.log";
        StandardErrorPath = "${cfg.workDir}/core.log";
        UserName = "_komodo";
        EnvironmentVariables = {
          HOME = cfg.workDir;
          KOMODO_CONFIG_PATH = "/etc/komodo/config/config.toml";
        };
        Program = "${lib.getExe' cfg.package "core"}";
      };
    };

    launchd.daemons.komodo-periphery = {
      serviceConfig = {
        Disabled = true;
        KeepAlive = true;
        RunAtLoad = true;
        WorkingDirectory = cfg.workDir;
        StandardOutPath = "${cfg.workDir}/periphery.log";
        StandardErrorPath = "${cfg.workDir}/periphery.log";
        UserName = "_komodo";
        EnvironmentVariables = {
          HOME = cfg.workDir;
          NIX_PATH = "$NIX_PATH";
          PATH = "${config.environment.systemPath}";
        };
        Program = "${lib.getExe' cfg.package "periphery"}";
      };
      script = ''
        ${lib.getExe' cfg.package "periphery"} --config ${format.generate "periphery.config.toml" cfg.settings.periphery}
      '';
    };
  };
}
