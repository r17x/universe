{
  config,
  lib,
  pkgs,
  ...
}:

with lib;

let
  cfg = config.services.unbound;

  format.generate =
    name: value:
    pipe value [
      (generators.toINI {
        mkSectionName = name: "${name}:"; # Override to remove brackets
        mkKeyValue = key: value: "  ${key}: ${toString value}"; # Colon instead of `=`
        listsAsDuplicateKeys = true;
      })
      (strings.replaceStrings [ "[" "]" ] [ "" "" ])
      (pkgs.writeText name)
    ];

in

{
  options.services.unbound = {
    enable = mkOption {
      type = types.bool;
      default = false;
      description = "Whether to enable the unbound service.";
    };

    package = mkOption {
      type = types.path;
      default = pkgs.unbound;
      defaultText = "pkgs.unbound";
      description = "This option specifies the unbound package to use";
    };

    settings = mkOption {
      type = types.attrs;
      description = ''
        This option specifies the unbound settings to use
        More details can be found at https://nlnetlabs.nl/documentation/unbound/unbound.conf/
      '';
    };
  };

  config = mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];
    environment.etc."resolver/localhost".text = ''
      nameserver 127.0.0.1
    '';
    environment.etc."unbound/unbound.conf".source = format.generate "unbound.conf" cfg.settings;
    launchd.daemons.unbound = {
      script = ''
        ${lib.getExe' cfg.package "unbound"} -p
      '';
      serviceConfig = {
        RunAtLoad = true;
        KeepAlive = true;
      };
    };
  };
}
