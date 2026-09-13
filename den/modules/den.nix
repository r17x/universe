{
  inputs,
  lib,
  config,
  ...
}:

let
  # Skip outputs.nix — its lib.evalModules wrapper forces eager evaluation of
  # all inputs as specialArgs, triggering a __functor bug in llms-agents.
  # Use flake-parts native resolution instead.
  denModulesPath = "${inputs.den}/modules";
  denModules = builtins.filter (
    p: lib.hasSuffix ".nix" p && !lib.hasInfix "/_" p && !lib.hasSuffix "/outputs.nix" p
  ) (lib.filesystem.listFilesRecursive denModulesPath);
in

{
  imports = denModules ++ [
    "${inputs.den}/modules/outputs/systems.nix"
  ];

  systems = config.den.systems;

  perSystem.imports = [
    (config.den.lib.aspects.resolve "flake-parts" (config.den.lib.resolveEntity "flake-parts" { }))
  ];

  flake = config.den.lib.aspects.resolve "flake" (config.den.lib.resolveEntity "flake" { });

  den.schema.user.classes = lib.mkDefault [ "homeManager" ];

  den.hosts.aarch64-darwin.eR17.users.r17 = { };
  den.hosts.aarch64-darwin.eR17x.users.r17 = { };

  den.default = {
    includes = [
      config.den.batteries.define-user
      config.den.batteries.hostname
    ];

    darwin =
      { inputs, ... }:
      {
        system.stateVersion = 4;
        inherit (inputs.self) nixpkgs;
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
