{ lib }:
let
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
    options.trustedUser = lib.mkOption { type = lib.types.str; };
    options.authorizedKeys = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
    };
    options.caches = lib.mkOption {
      type = lib.types.attrsOf cacheType;
      default = { };
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
    options.enable = lib.mkOption {
      type = lib.types.bool;
      default = false;
    };
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
in
{
  userModule = {
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
    options.mail = lib.mkOption {
      type = lib.types.attrsOf lib.types.anything;
      default = { };
    };
    options.git = lib.mkOption {
      type = gitType;
      default = { };
    };
  };

  hostModule = {
    options.apps = lib.mkOption {
      type = appsType;
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
  };
}
