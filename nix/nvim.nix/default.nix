{
  inputs,
  config,
  lib,
  ...
}:
let
  nixvimLib = inputs.nixvim.lib;

  mkNvimConfiguration =
    { system, modules }:
    let
      helpers = nixvimLib.nixvim.extend (
        _final: _prev: {
          mkLuaFunWithName =
            name: lua: # lua
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
    in
    nixvimLib.evalNixvim {
      inherit system;
      modules = modules ++ [
        {
          nixpkgs.source = inputs.nixpkgs-nixvim;
          nixpkgs.config.allowUnfree = true;
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
        inherit (inputs.self) icons;
        inherit helpers system;
        self = inputs.self;
        inherit inputs;
      };
    };

  allHosts = lib.concatMapAttrs (_system: hosts: hosts) config.den.hosts;
in
{
  imports = [ inputs.nixvim.flakeModules.default ];

  flake.neovimConfigurations = lib.mapAttrs (
    _name: host:
    mkNvimConfiguration {
      system = host.system;
      modules = [
        (config.den.lib.aspects.resolve "nixvim" host.resolved)
      ];
    }
  ) allHosts;

  perSystem =
    { ... }:
    {
      packages.nvim = config.flake.neovimConfigurations.eR17.config.build.package;
      checks.nvim = config.flake.neovimConfigurations.eR17.config.build.test;
    };
}
