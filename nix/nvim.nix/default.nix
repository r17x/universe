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
      helpers = nixvimLib.nixvim.extend (
        _final: _prev: {
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
        }
      );
      configuration = nixvimLib.evalNixvim {
        inherit system;
        modules = [
          ./config
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
      packages = {
        inherit nvim;
      };
    };
}
