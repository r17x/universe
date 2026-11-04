/**
  How to use this modules:

  ```nix
  imports = [
    inputs.r17x.nixModules.nix
    {
      nix-settings.use = "minimal";
      nix-settings.inputs-to-registry = true;
    }
  ];
  ```
*/

{
  lib,
  config,
  pkgs,
  inputs,
  ...
}:

let
  cfg = config.nix-settings;
  hasFull = cfg.use == "full";
  isFull = lib.optionals hasFull;
  flakeInputs = lib.attrsets.filterAttrs (_: lib.isType "flake") inputs;
in
{
  options.nix-settings = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Whether to enable the nix settings.
      '';
    };

    use = lib.mkOption {
      type = lib.types.enum [
        "minimal"
        "full"
      ];
      default = "minimal";
      description = ''
        The nix settings to use.

        Valid values are: "minimal", "full".
      '';
    };
    inputs-to-registry = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Whether to add inputs to the registry.

        it will turn inputs.<NAME> to the nix.registry.<NAME>.flake
      '';
    };
  };

  config = lib.mkMerge [
    (lib.mkIf cfg.enable {
      nix = rec {
        nixPath =
          [
            "nixpkgs=${inputs.nixpkgs}"
          ]
          ++ lib.optionals cfg.inputs-to-registry (
            lib.mapAttrsToList (name: flake: "${name}=${flake}") flakeInputs
          );

        registry =
          {
            nixpkgs.flake = inputs.nixpkgs;
          }
          // lib.optionalAttrs cfg.inputs-to-registry (
            lib.attrsets.concatMapAttrs (name: flake: {
              ${name} = { inherit flake; };
            }) flakeInputs
          );

        settings =
          {
            nix-path = nixPath;
            experimental-features =
              [
                "flakes"
                "nix-command"
              ]
              ++ isFull [
                "pipe-operators"
                "auto-allocate-uids"
                "ca-derivations"
              ];
          }
          // (
            lib.optionalAttrs hasFull {

              accept-flake-config = true;
              download-attempts = 1;
              fallback = true;
              http-connections = 0;
              max-jobs = "auto";

              trusted-users = [
                config.system.primaryUser
                "root"
                "@admin"
              ];

            }
            // (lib.optionalAttrs (pkgs.stdenv.isDarwin && pkgs.stdenv.isAarch64) {
              extra-platforms = "x86_64-darwin aarch64-darwin";
            })
          );
      };
    })
    (lib.mkIf (cfg.enable && hasFull && !config.nix.enable) {
      determinateNix.customSettings.trusted-users = [
        config.system.primaryUser
        "root"
        "@admin"
      ];
    })
    (lib.mkIf (cfg.enable && hasFull) (
      lib.mkIf config.nix.enable {
        nix.optimise.automatic = true;
        nix.gc = {
          automatic = true;
          options = "--delete-older-than 30d";
        };
        nix.extraOptions = ''
          keep-outputs = true
          keep-derivations = true
          auto-allocate-uids = false
        '';
      }
    ))
  ];
}
