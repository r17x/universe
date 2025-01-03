{ self, inputs, ... }:
{
  perSystem =
    {
      icons,
      branches,
      pkgs,
      system,
      ...
    }:
    let
      nixvimLib = inputs.nixvim.lib.${system};
      helpers = nixvimLib.helpers // {
        mkLuaFunWithName =
          name: lua:
          # lua
          ''
            function ${name}()
              ${lua}
            end
          '';

        mkLuaFun =
          lua: # lua
          ''
            function()
              ${lua}
            end
          '';
      };
      nixvim' = inputs.nixvim.legacyPackages.${system};
      nixvimModule = {
        inherit pkgs;
        module = import ./config; # import the module directly
        # You can use `extraSpecialArgs` to pass additional arguments to your module files
        extraSpecialArgs = {
          inherit
            icons
            branches
            helpers
            system
            self
            ;
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
