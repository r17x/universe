{ self, inputs, ... }:
{
  imports = [
    # Import nixvim's flake-parts module;
    # Adds `flake.nixvimModules` and `perSystem.nixvimConfigurations`
    inputs.nixvim.flakeModules.default
  ];

  perSystem =
    {
      icons,
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
      configuration = nixvimLib.evalNixvim {
        inherit system;
        modules = [
          self.nixvimModules.default
          {
            nixpkgs.config = {
              allowUnfree = true;
            };
            nixpkgs.overlays = [
              (_: prev: {
                vimPlugins = prev.vimPlugins.extend (
                  _: __:
                  {
                    hud-colorschemes = prev.callPackage "${inputs.self}/nix/packages/hud-colorschemes" { };
                  }
                  // (import "${inputs.self}/nix/overlays/mkFlake2VimPlugin.nix" inputs { pkgs = prev; })
                );
              })
            ];
          }
        ];
        extraSpecialArgs = {
          inherit
            icons
            helpers
            system
            self
            inputs
            ;
        };

      };
      nvim = configuration.config.build.package;
    in
    {
      checks = {
        # Run `nix flake check .` to verify that your config is not broken
        nvim = configuration.config.build.test;
      };

      packages = {
        # Lets you run `nix run .` to start nixvim
        inherit nvim;
      };
    };
}
