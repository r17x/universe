{ inputs, ... }:

{
  imports = [
    ./ocamlPackages
    ./nodePackages
    ./mac-pkgs
  ];

  flake.overlays.default = final: prev: {
    inherit (inputs.nixpkgs-stable.legacyPackages.${prev.stdenv.hostPlatform.system})
      nixd
      nixf
      nixt
      ;

    branches =
      let
        pkgsFrom =
          branch: system:
          import branch {
            inherit system;
            inherit (inputs.self.nixpkgs) config;
          };
      in
      {
        master = pkgsFrom inputs.nixpkgs-master prev.stdenv.system;
        stable = pkgsFrom inputs.nixpkgs-stable prev.stdenv.system;
        unstable = pkgsFrom inputs.nixpkgs-unstable prev.stdenv.system;
      };

    sf-mono-liga-bin = prev.stdenvNoCC.mkDerivation (finalAttrs: {
      pname = "sf-mono-liga-bin";
      version = "7723040ef50633da5094f01f93b96dae5e9b9299";

      src = prev.fetchFromGitHub {
        owner = "shaunsingh";
        repo = "SFMono-Nerd-Font-Ligaturized";
        rev = finalAttrs.version;
        sha256 = "sha256-vPUl6O/ji4hHIH7/qSbUe7q1QdugE1D1ZRw92QcSSDQ=";
      };

      dontConfigure = true;
      installPhase = ''
        mkdir -p $out/share/fonts/opentype
        cp -R $src/*.otf $out/share/fonts/opentype
      '';
    });

    nixfmt = prev.nixfmt-rfc-style;

    sketchybar-app-font = prev.stdenv.mkDerivation {
      name = "sketchybar-app-font";
      src = inputs.sketchybar-app-font;
      buildInputs = [
        final.nodejs
        final.nodePackages.svgtofont
      ];
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
      # Add here any grammars that you want to use but not yet included in NixOS/nixpkgs
      # example:
      # ```nix
      # tree-sitter-rescript = prev.tree-sitter.buildGrammar {
      #   version = inputs.ts-rescript.lastModifiedDate;
      #   language = "rescript";
      #   generate = true;
      #   src = inputs.ts-rescript;
      # };
      # ```
    };

    vimPlugins = prev.vimPlugins.extend (
      _: _: { } // (import ./mkFlake2VimPlugin.nix inputs { pkgs = prev; })
    );

    fishPlugins = prev.fishPlugins // {
      nix-env = {
        name = "nix-env";
        src = inputs.nix-env;
      };
    };
  };
}
