##################################################################
#                       Development shells
##################################################################
{ self, ... }:

{
  perSystem = { pkgs, config, ... }:
    {
      pre-commit.check.enable = true;
      pre-commit.devShell = self.devShells.default;
      pre-commit.settings.hooks = {
        actionlint.enable = true;
        shellcheck.enable = true;
        stylua.enable = true;
        # TODO https://github.com/cachix/pre-commit-hooks.nix/issues/196
        # make override and pass configuration
        luacheck.enable = false;

        # .nix related
        deadnix.enable = true;
        nixpkgs-fmt.enable = true;
      };


      devShells = {
        default = pkgs.mkShell {
          shellHook = ''
            ${config.pre-commit.installationScript}
          '';
        };
        #
        #
        #    $ nix develop github:r17x/nixpkgs#node18
        #
        #
        node18 = pkgs.mkShell {
          description = "Node.js 18 Development Environment";
          buildInputs = with pkgs; [
            nodejs_18
            (nodePackages.yarn.override { nodejs = nodejs_18; })
          ];
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
        #    $ nix develop github:r17x/nixpkgs#pnpm
        #
        #
        pnpm = pkgs.mkShell {
          description = "Nodejs with PNPM";

          buildInputs = with pkgs; [
            nodejs_18
            (nodePackages.pnpm.override { nodejs = nodejs_18; })
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
