{ inputs, ... }:
{
  perSystem =
    {
      branches,
      pkgs,
      system,
      ...
    }:
    let
      icons = import ../nix/icons.nix;
      nixvimLib = inputs.nixvim.lib.${system};
      nixvim' = inputs.nixvim.legacyPackages.${system};
      nixvimModule = {
        inherit pkgs;
        module = import ./config; # import the module directly
        # You can use `extraSpecialArgs` to pass additional arguments to your module files
        extraSpecialArgs = {
          inherit icons branches;
        };
      };
      nvim = nixvim'.makeNixvimWithModule nixvimModule;
    in
    {
      checks = {
        # Run `nix flake check .` to verify that your config is not broken
        nvim = nixvimLib.check.mkTestDerivationFromNixvimModule nixvimModule;
      };

      packages = {
        # Lets you run `nix run .` to start nixvim
        inherit nvim;
      };
    };
}
