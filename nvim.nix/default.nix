{ inputs, ... }:
{
  perSystem =
    { pkgs
    , system
    , ...
    }:
    let
      nixvimLib = inputs.nixvim.lib.${system};
      nixvim' = inputs.nixvim.legacyPackages.${system};
      nixvimModule = {
        inherit pkgs;
        module = import ./config; # import the module directly
        # You can use `extraSpecialArgs` to pass additional arguments to your module files
        # extraSpecialArgs = {
        #   # inherit (inputs) foo;
        # };
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

