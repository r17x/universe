{ inputs, ... }:

{
  flake.overlays.default = final: prev: {
    luajitPackages = prev.luajitPackages // {
      luafun = prev.luajitPackages.buildLuarocksPackage {
        pname = "fun";
        version = "scm-1";

        src = inputs.luafun;

        disabled = (prev.luajitPackages.luaOlder "5.1") || (prev.luajitPackages.luaAtLeast "5.4");
        propagatedBuildInputs = [ prev.lua ];

        meta = {
          homepage = "https://luafun.github.io/";
          description = "High-performance functional programming library for Lua";
          license.fullName = "MIT/X11";
        };
      };
    };
    tree-sitter-grammars = prev.tree-sitter-grammars // {
      tree-sitter-rescript =
        prev.tree-sitter.buildGrammar {
          version = inputs.ts-rescript.lastModifiedDate;
          language = "rescript";
          generate = true;
          src = inputs.ts-rescript;
        };
    };
    vimPlugins = prev.vimPlugins.extend (_: _: { } //
      (import ./mkFlake2VimPlugin.nix inputs { pkgs = prev; })
    );
  }
  // (import ./mac-pkgs final prev)
  // (inputs.dvt.overlay final prev)
  ;
}
