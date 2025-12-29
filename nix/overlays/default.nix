{ inputs, ... }:

{
  imports = [
    ./ocamlPackages
    ./nodePackages
    ./mac-pkgs
  ];

  flake.overlays.default =
    final: prev:
    let
      system = prev.stdenv.hostPlatform.system;
    in
    {
      inherit (inputs.nixpkgs-stable.legacyPackages.${system})
        nixd
        nixf
        nixt
        ;

      inherit (inputs.llms-agents.packages.${system}) claude-code;

      lib = prev.lib.extend (import ./lib.nix);

      # flake.nix: inputs.nixpkgs-stable -> pkgs.branches.stable
      branches = final.lib.mkChannels {
        inherit inputs;
        nixpkgsArgs = {
          inherit system;
          inherit (inputs.self.nixpkgs) config;
        };
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
        _: __:
        {
          # avante-nvim = p.avante-nvim.overrideAttrs (_: {
          #   src = prev.fetchFromGitHub {
          #     owner = "yetone";
          #     repo = "avante.nvim";
          #     rev = "4dde29f9869ef998cb308b179aa8bd28778c1106";
          #     hash = "sha256-6juWFG16ydfGPOx+FrskLoKNOB0ra70bAJXB2YQ1Fck=";
          #   };
          # });
        }
        // (import ./mkFlake2VimPlugin.nix inputs { pkgs = prev; })
      );

      fishPlugins = prev.fishPlugins // {
        nix-env = {
          name = "nix-env";
          src = inputs.nix-env;
        };
      };
    };
}
