{ inputs, ... }:
{
  den.aspects.tooling = {
    flake-parts =
      {
        system,
        inputs',
        ...
      }:
      {
        formatter = inputs'.nixpkgs.legacyPackages.nixfmt-rfc-style;

        _module.args = {
          inherit (inputs.self) icons colors color;
          extraModuleArgs = {
            inherit (inputs.self) icons colors color;
          };
          pkgs = import inputs.nixpkgs {
            inherit system;
            inherit (inputs.self.nixpkgs) config overlays;
          };
        };
      };
  };
}
