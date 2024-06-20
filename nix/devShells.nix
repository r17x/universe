##################################################################
#                       Development shells
##################################################################
{ self, ... }:

{
  perSystem = { pkgs, config, ... }: {
    pre-commit.check.enable = true;
    pre-commit.devShell = self.devShells.default;
    pre-commit.settings.hooks = {
      actionlint.enable = true;
      shellcheck.enable = true;
      stylua.enable = true;
      luacheck.enable = false;
      deadnix.enable = true;
      nixpkgs-fmt.enable = true;
    };


    devShells =
      let
        nodeCorepackShims = nodejs: pkgs.stdenv.mkDerivation {
          name = "corepack-shims";
          buildInputs = [ nodejs ];
          phases = [ "installPhase" ];
          installPhase = ''
            mkdir -p $out/bin
            corepack enable --install-directory=$out/bin
          '';
        };
      in
      {
        default = pkgs.mkShell {
          shellHook = ''
            ${config.pre-commit.installationScript}
          '';
        };

        #
        #
        #    $ nix develop github:r17x/nixpkgs#ocamlorg
        #
        #
        ocamlorg =
          let ocamlPackages = pkgs.ocaml-ng.ocamlPackages_4_14; in
          pkgs.mkShell {
            description = "OCaml.org development environment";
            buildInputs = with ocamlPackages; [ ocaml merlin ];
            nativeBuildInputs = with pkgs; [
              opam
              pkg-config
              libev
              oniguruma
              openssl
              gmp
            ];
          };

        #
        #
        #    $ nix develop github:r17x/nixpkgs#melange
        #
        #
        melange = pkgs.mkShell {
          description = "Melange Development Environment with OCaml 5_2";
          nativeBuildInputs = with pkgs.ocamlPackages; [
            ocaml
            dune_3
            findlib
            ocaml-lsp
            ocamlformat
            reason
            merlin
            melange
          ];
          buildInputs = with pkgs.ocamlPackages; [
            melange
            reason-react
            reason-react-ppx
            pkgs.nodejs_20
            (nodeCorepackShims pkgs.nodejs_20)
          ];
        };

        #
        #
        #    $ nix develop github:r17x/nixpkgs#node18
        #
        #
        node18 = pkgs.mkShell {
          description = "Node.js 18 Development Environment";
          buildInputs = [
            pkgs.nodejs_18
            (nodeCorepackShims pkgs.nodejs_18)
          ];
        };

        #
        #
        #    $ nix develop github:r17x/nixpkgs#node20
        #
        #
        node20 = pkgs.mkShell {
          description = "Node.js 20 Development Environment";
          buildInputs = [
            pkgs.nodejs_20
            (nodeCorepackShims pkgs.nodejs_20)
          ];
        };

        #
        #
        #    $ nix develop github:r17x/nixpkgs#node21
        #
        #
        node21 = pkgs.mkShell {
          description = "Node.js 21 Development Environment";
          buildInputs = [
            pkgs.nodejs_21
            (nodeCorepackShims pkgs.nodejs_21)
          ];
        };


        #
        #
        #    $ nix develop github:r17x/nixpkgs#go
        #
        #
        go = pkgs.mkShell {
          description = "Go Development Environment";
          nativeBuildInputs = [ pkgs.go ];
          shellHook = ''
            export GOPATH="$(${pkgs.go}/bin/go env GOPATH)"
            export PATH="$PATH:$GOPATH/bin"
          '';
        };


        #
        #
        #    $ nix develop github:r17x/nixpkgs#rust-wasm
        #
        #
        rust-wasm = pkgs.mkShell {
          description = "Rust  Development Environment";
          # declared ENV variables when starting shell
          RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";

          nativeBuildInputs = with pkgs; [ rustc cargo gcc rustfmt clippy ];
        };

        #
        #
        #    $ nix develop github:r17x/nixpkgs#bun
        #
        #
        bun = pkgs.mkShell {
          buildInputs = [ pkgs.bun ];
        };
      };

  };
}
