top@{
  lib,
  config,
  ...
}:

let
  genRebuildCommand =
    system: config:
    ''${
      lib.getExe' config.system.build."${system}-rebuild" "${system}-rebuild"
    } switch --flake ${top.self}#${config.networking.hostName}'';

  commands = {
    darwin = lib.concatStringsSep "\n" (
      lib.mapAttrsToList (name: config: "${name}) ${genRebuildCommand "darwin" config.config} ;;") (
        config.flake.darwinConfigurations or { }
      )
    );
    nixos = lib.concatStringsSep "\n" (
      lib.mapAttrsToList (name: config: "${name}) ${genRebuildCommand "nixos" config.config} ;;") (
        config.flake.nixosConfigurations or { }
      )
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
              ${if pkgs.stdenv.isLinux then commands.nixos else commands.darwin}
              *) echo "No matching configuration found for $HOSTNAME on Linux" ;;
            esac
          '';
        };
      };
  };
}
