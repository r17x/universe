{
  inputs,
  lib,
  config,
  den,
  ...
}:

let
  denModulesPath = "${inputs.den}/modules";
  denModules = builtins.filter (
    p: lib.hasSuffix ".nix" p && !lib.hasInfix "/_" p && !lib.hasSuffix "/outputs.nix" p
  ) (lib.filesystem.listFilesRecursive denModulesPath);

  icons = import ../icons.nix;
  colors = import ../colors.nix { inherit lib; };
  color = colors.mkColor colors.lists.edge;

  inherit (den.lib.policy) resolve pipe;
in

{
  imports = denModules ++ [
    "${inputs.den}/modules/outputs/systems.nix"
    (inputs.import-tree ./aspects)
    ./classes/tests.nix
    ./schema/user.nix
    ./schema/profile.nix
    ../../r17.nix
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
    {
      nixpkgs = {
        config = {
          allowBroken = true;
          allowUnfree = true;
          tarball-ttl = 0;
          contentAddressedByDefault = false;
        };

        overlays = lib.attrValues inputs.self.overlays ++ [
          inputs.ocaml-nvim.overlays.default
        ];
      };

      inherit icons colors color;
    }
    // (lib.evalModules {
      modules = (resolved.imports or [ ]) ++ [
        inputs.den.flakeOutputs.darwinConfigurations
        inputs.den.flakeOutputs.homeConfigurations
      ];
      specialArgs = {
        inherit inputs;
      };
    }).config.flake;

  den.classes.nixvim.description = "Nixvim editor configuration";

  den.quirks.runtime = {
    description = "Runtime-switchable aspect property declarations";
  };

  den.schema.user.classes = lib.mkDefault [ "homeManager" ];
  den.schema.user.includes = [ config.den.batteries.host-aspects ];
  den.schema.flake-parts.includes = [ config.den.aspects.tooling ];

  den.default = {
    includes = with config.den.batteries; [
      define-user
      hostname
      primary-user
      ({ user, ... }: user-shell user.shell)
      config.den.aspects.${"runtime-manifest"}
      den.default.policies.theming
      den.default.policies.runtime-manifest
    ];

    policies.theming = _: [
      (resolve {
        inherit color colors icons;
      })
    ];

    policies.runtime-manifest =
      { user, ... }:
      assert user != null;
      [
        (pipe.from "runtime" [
          pipe.expose
        ])
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
      };

    homeManager = {
      home.stateVersion = "25.05";
    };
  };
}
