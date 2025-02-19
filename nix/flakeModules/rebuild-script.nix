top@{
  lib,
  config,
  ...
}:

let
  darwinConfigs = config.flake.darwinConfigurations or { };
  nixosConfigs = config.flake.nixosConfigurations or { };

  genCommand =
    system: configs: name:
    ''${name}) ${
      lib.getExe' configs.${name}.config.system.build."${system}-rebuild" "${system}-rebuild"
    } switch --flake ${top.self}#${name} ;;'';

  commands = {
    Darwin = lib.concatStringsSep "\n" (
      map (genCommand "darwin" darwinConfigs) (lib.attrNames darwinConfigs)
    );
    Linux = lib.concatStringsSep "\n" (
      map (genCommand "nixos" nixosConfigs) (lib.attrNames nixosConfigs)
    );
  };

in
{
  options.rebuild-scripts.enable = lib.mkEnableOption "Enable activation scripts for nixos or nix-darwin configurations";

  config = lib.mkIf config.rebuild-scripts.enable {
    perSystem =
      { pkgs, ... }:
      {
        apps.rebuild = {
          type = "app";
          program = pkgs.writeShellScriptBin "activation" ''
            HOSTNAME=$(hostname)
            while [[ "$1" ]]; do
              case "$1" in
                --host=*) HOSTNAME="''${1#--host=}" ;;
              esac
              shift
            done
            case $HOSTNAME in
              ${if pkgs.stdenv.isLinux then commands.Linux else commands.Darwin}
              *) echo "No matching configuration found for $HOSTNAME on Linux" ;;
            esac
          '';
        };
      };
  };
}
