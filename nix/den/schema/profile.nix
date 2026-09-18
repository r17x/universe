{
  config,
  den,
  inputs,
  lib,
  ...
}:
let
  types = import ./types.nix { inherit lib; };
  inherit (den.lib.policy) include;

  profileType = lib.types.submodule (
    { name, ... }:
    {
      options = {
        user = lib.mkOption {
          type = lib.types.submodule {
            imports = [ types.userModule ];
            options.userName = lib.mkOption {
              type = lib.types.str;
              default = name;
            };
            options.classes = lib.mkOption {
              type = lib.types.listOf lib.types.str;
              default = [ "homeManager" ];
            };
          };
        };

        hosts = lib.mkOption {
          type = lib.types.attrsOf (
            lib.types.submodule {
              freeformType = lib.types.attrsOf lib.types.anything;
              options.system = lib.mkOption {
                type = lib.types.nullOr lib.types.str;
                default = null;
              };
              options.extends = lib.mkOption {
                type = lib.types.nullOr lib.types.str;
                default = null;
              };
            }
          );
        };

        services = lib.mkOption {
          type = lib.types.attrsOf lib.types.anything;
          default = { };
        };
      };
    }
  );

  profiles = config.den.profiles;

  resolveHost =
    hosts: name:
    let
      host = hosts.${name};
      inherited = if host.extends == null then { } else resolveHost hosts host.extends;
      own =
        removeAttrs host [
          "extends"
          "system"
        ]
        // lib.optionalAttrs (host.system != null) {
          inherit (host) system;
        };
    in
    lib.recursiveUpdate inherited own;

  darwinSystem =
    args:
    inputs.nix-darwin.lib.darwinSystem (
      args
      // {
        specialArgs = (args.specialArgs or { }) // {
          inherit inputs;
        };
      }
    );

  mkProfileHosts =
    profileName: profile:
    lib.mapAttrs (
      hostName: _:
      let
        host = resolveHost profile.hosts hostName;
        builder = host.builder or null;
      in
      host
      // {
        users.${profileName} = profile.user;
        instantiate =
          if lib.hasSuffix "darwin" host.system then darwinSystem else inputs.nixpkgs.lib.nixosSystem;
      }
      // lib.optionalAttrs (builder != null) {
        builder = builder // {
          trustedUser = profile.user.userName;
          authorizedKeys = profile.user.keys;
          caches = profile.user.caches;
        };
      }
    ) profile.hosts;
in
{
  options.den.profiles = lib.mkOption {
    type = lib.types.attrsOf profileType;
    default = { };
    description = "Profile data projected into Den host and user entities";
  };

  config = {
    den.schema.host.imports = [ types.hostModule ];

    den.hosts = lib.mkMerge (lib.mapAttrsToList mkProfileHosts profiles);

    den.policies.profile-host-effects =
      { host, ... }:
      lib.optionals (host.builder != null) [ (include den.aspects.builder) ]
      ++ lib.optionals (host.dns != null || host.mesh != null) [ (include den.aspects.network) ];

    den.schema.host.includes = [ den.policies.profile-host-effects ];
  };
}
