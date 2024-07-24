{ inputs, ... }:

{
  imports = [
    ./ocamlPackages
    ./nodePackages
  ];

  flake.overlays.default = final: prev: {
    sketchybar-app-font = prev.stdenv.mkDerivation {
      name = "sketchybar-app-font";
      src = inputs.sketchybar-app-font;
      buildInputs = [ final.nodejs final.nodePackages.svgtofont ];
      buildPhase = ''
        ln -s ${final.nodePackages.svgtofont}/lib/node_modules ./node_modules
        node ./build.js
      '';
      installPhase = ''
        mkdir -p $out/share/fonts
        cp -r dist/*.ttf $out/share/fonts
      '';
    };

    iamb = inputs.iamb.packages.${prev.stdenv.hostPlatform.system}.default;

    tree-sitter-grammars = prev.tree-sitter-grammars // {
      tree-sitter-rescript = prev.tree-sitter.buildGrammar {
        version = inputs.ts-rescript.lastModifiedDate;
        language = "rescript";
        generate = true;
        src = inputs.ts-rescript;
      };
    };

    vimPlugins = prev.vimPlugins.extend (_: _: { } //
      (import ./mkFlake2VimPlugin.nix inputs { pkgs = prev; })
    );

    fishPlugins = prev.fishPlugins // {
      nix-env = {
        name = "nix-env";
        src = inputs.nix-env;
      };
    };
  }
  // (import ./mac-pkgs final prev);
}
