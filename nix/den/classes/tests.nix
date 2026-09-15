{
  den,
  inputs,
  config,
  ...
}:
let
  inherit (den.lib.policy) route resolve;
in
{
  imports = [
    inputs.nix-unit.modules.flake.default
    inputs.den.flakeModules.denTest
  ];

  denTest = {
    imports = [
      inputs.den.flakeOutputs.nixosConfigurations
      inputs.den.flakeOutputs.homeConfigurations
    ];
  };

  den.classes.tests = { };

  perSystem.nix-unit = {
    allowNetwork = true;
    inputs = inputs;
  };

  den.policies.tests-to-flake-parts = _: [
    (route {
      fromClass = "tests";
      intoClass = "flake-parts";
      collectSubtree = true;
      path = [
        "nix-unit"
        "tests"
      ];
      adaptArgs =
        args:
        let
          eR17 = config.flake.darwinConfigurations.eR17.config;
          eR17x = config.flake.darwinConfigurations.eR17x.config;
        in
        args.config.allModuleArgs // { inherit eR17 eR17x; };
    })
  ];

  den.policies.tests-from-hosts =
    _:
    map (host: resolve.to "host" { inherit host; }) (
      builtins.concatMap builtins.attrValues (builtins.attrValues den.hosts)
    );

  den.schema.flake-parts.includes = [
    den.policies.tests-to-flake-parts
    den.policies.tests-from-hosts
    den.aspects.foundation
    den.aspects.den-tests
  ];
}
