{ self, inputs, ... }:
{
  perSystem =
    {
      icons,
      pkgs,
      system,
      ...
    }:
    let
      nixvimLib = inputs.nixvim.lib;
      helpers = nixvimLib.nixvim // {
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
            helpers
            system
            self
            ;
        };
      };
      nvim = nixvim'.makeNixvimWithModule nixvimModule;
      nvimCheck = nixvimLib.${system}.check.mkTestDerivationFromNixvimModule nixvimModule;
    in
    {
      checks = {
        # Run `nix flake check .` to verify that your config is not broken
        nvim = nvimCheck;
      };

      packages = {
        # Lets you run `nix run .` to start nixvim
        inherit nvim;
      };
    };
}
