{
  inputs,
  lib,
  config,
  ...
}:

let
  denModulesPath = "${inputs.den}/modules";
  denModules = builtins.filter (
    p: lib.hasSuffix ".nix" p && !lib.hasInfix "/_" p && !lib.hasSuffix "/outputs.nix" p
  ) (lib.filesystem.listFilesRecursive denModulesPath);

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
in

{
  imports = denModules ++ [
    "${inputs.den}/modules/outputs/systems.nix"
    (inputs.import-tree ./aspects)
    ./classes/tests.nix
    ./tests
    ./diagrams.nix
  ];

  systems = config.den.systems;

  perSystem.imports = [
    (config.den.lib.aspects.resolve "flake-parts" (config.den.lib.resolveEntity "flake-parts" { }))
  ];

  flake =
    let
      resolved = config.den.lib.aspects.resolve "flake" (config.den.lib.resolveEntity "flake" { });
    in
    (lib.evalModules {
      modules = (resolved.imports or [ ]) ++ [
        inputs.den.flakeOutputs.darwinConfigurations
        inputs.den.flakeOutputs.homeConfigurations
      ];
      specialArgs = {
        inherit inputs;
      };
    }).config.flake;

  den.classes.nixvim.description = "Nixvim editor configuration";

  den.schema.user.classes = lib.mkDefault [ "homeManager" ];
  den.schema.user.includes = [ config.den.batteries.host-aspects ];
  den.schema.flake-parts.includes = [ config.den.aspects.tooling ];

  den.hosts.aarch64-darwin.eR17 = {
    instantiate = darwinSystem;
    users.r17 = { };
  };
  den.hosts.aarch64-darwin.eR17x = {
    instantiate = darwinSystem;
    users.r17 = { };
  };

  den.default = {
    includes = with config.den.batteries; [
      define-user
      hostname
    ];

    darwin =
      { inputs, ... }:
      {
        system.stateVersion = 4;
        inherit (inputs.self) nixpkgs;
        home-manager.backupFileExtension = "backup-before-nix-home-manager";
        home-manager.useGlobalPkgs = true;
        home-manager.useUserPackages = true;
        home-manager.extraSpecialArgs = {
          inherit inputs;
        };
        _module.args = {
          colors = inputs.self.colors;
          color = inputs.self.color;
          icons = inputs.self.icons;
          self = inputs.self;
        };
      };

    homeManager =
      { inputs, ... }:
      {
        home.stateVersion = "25.05";
        _module.args = {
          color = inputs.self.color;
          colors = inputs.self.colors;
          icons = inputs.self.icons;
        };
      };
  };
}
