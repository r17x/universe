{
  lib,
  den,
  config,
  ...
}:
let
  inherit (den.lib.policy) resolve;

  cacheType = lib.types.submodule {
    options.url = lib.mkOption { type = lib.types.str; };
    options.key = lib.mkOption { type = lib.types.str; };
  };

  workspaceType = lib.types.submodule {
    options.path = lib.mkOption { type = lib.types.str; };
    options.sessionName = lib.mkOption { type = lib.types.str; };
  };

  builderType = lib.types.submodule {
    options.diskSize = lib.mkOption {
      type = lib.types.int;
      default = 40 * 1024;
    };
    options.memorySize = lib.mkOption {
      type = lib.types.int;
      default = 8 * 1024;
    };
    options.cores = lib.mkOption {
      type = lib.types.int;
      default = 6;
    };
    options.maxJobs = lib.mkOption {
      type = lib.types.int;
      default = 4;
    };
    options.systems = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [
        "x86_64-linux"
        "aarch64-linux"
      ];
    };
  };

  dnsType = lib.types.submodule {
    options.dnscrypt = lib.mkOption {
      type = lib.types.attrsOf lib.types.anything;
      default = { };
    };
    options.unbound = lib.mkOption {
      type = lib.types.attrsOf lib.types.anything;
      default = { };
    };
  };

  meshType = lib.types.submodule {
    options.peers = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
    };
    options.publicKey = lib.mkOption { type = lib.types.str; };
    options.settings = lib.mkOption {
      type = lib.types.attrsOf lib.types.anything;
      default = { };
    };
  };

  appsType = lib.types.submodule {
    options.masApps = lib.mkOption {
      type = lib.types.attrsOf lib.types.int;
      default = { };
    };
  };

  gitType = lib.types.submodule {
    options.urlRewrites = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
    };
  };

  extendUserSchema =
    { lib, ... }:
    {
      options.handle = lib.mkOption { type = lib.types.str; };
      options.shell = lib.mkOption {
        type = lib.types.str;
        default = "fish";
      };
      options.keys = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
      };
      options.caches = lib.mkOption {
        type = lib.types.attrsOf cacheType;
        default = { };
      };
      options.primaryCache = lib.mkOption {
        type = lib.types.str;
        default = "";
      };
      options.configDirectory = lib.mkOption {
        type = lib.types.str;
        default = "~/.config/nixpkgs";
      };
      options.font = lib.mkOption {
        type = lib.types.str;
        default = "Kode Mono";
      };
      options.browsers = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
      };
      options.secrets = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
      };
      options.gpgTrust = lib.mkOption {
        type = lib.types.attrsOf lib.types.str;
        default = { };
      };
      options.sessionVariables = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      options.sessionPath = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
      };
      options.workspaces = lib.mkOption {
        type = lib.types.attrsOf workspaceType;
        default = { };
      };
      options.packageOverrides = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      options.apps = lib.mkOption {
        type = appsType;
        default = { };
      };
      options.mail = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      options.git = lib.mkOption {
        type = gitType;
        default = { };
      };
      options.builder = lib.mkOption {
        type = lib.types.nullOr builderType;
        default = null;
      };
      options.dns = lib.mkOption {
        type = lib.types.nullOr dnsType;
        default = null;
      };
      options.mesh = lib.mkOption {
        type = lib.types.nullOr meshType;
        default = null;
      };
      options.services = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
    };

  registryUserType = lib.types.submodule (
    { name, config, ... }:
    {
      freeformType = lib.types.attrsOf lib.types.anything;
      imports = [ den.schema.user ];
      config._module.args.user = config;
      options = {
        name = lib.mkOption {
          type = lib.types.str;
          default = name;
        };
        userName = lib.mkOption {
          type = lib.types.str;
          default = name;
        };
        classes = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ "homeManager" ];
        };
        aspect = lib.mkOption {
          type = lib.types.raw;
          default = den.aspects.${name} or { };
        };
      };
    }
  );

  registry = config.den.users.registry;
in
{
  options.den.users.registry = lib.mkOption {
    type = lib.types.attrsOf registryUserType;
    default = { };
  };

  config = {
    den.schema.user.imports = [ extendUserSchema ];

    den.policies.registry-users =
      _: lib.mapAttrsToList (_: userData: resolve.to "user" { user = userData; }) registry;

    den.schema.host.includes = [ den.policies.registry-users ];
    den.schema.host.excludes = [ den.policies.host-to-users ];
  };
}
