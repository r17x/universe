##################################################################
#                       Development shells
##################################################################
{ self, ... }:

{
  perSystem =
    { pkgs, config, ... }:
    {
      pre-commit.check.enable = true;
      pre-commit.devShell = self.devShells.default;
      pre-commit.settings.hooks = {
        actionlint.enable = true;
        shellcheck.enable = true;
        stylua.enable = true;
        luacheck.enable = false;
        deadnix.enable = true;
        deadnix.excludes = [ "nix/overlays/nodePackages/node2nix" ];
        # nixpkgs-fmt.enable = true;  # see https://x.com/zimbatm/status/1816148339131343058
        nixfmt.enable = true;
        dune-fmt.enable = true;
        dune-fmt.settings.extraRuntimeInputs = [ pkgs.ocamlPackages.ocamlformat ];
        dune-fmt.files = "apps/rin.rocks";
        dune-fmt.entry = "dune build @fmt --root=apps/rin.rocks --auto-promote";
      };

      devShells =
        let
          inherit (pkgs) lib;
          mutFirstChar =
            f: s:
            let
              firstChar = f (lib.substring 0 1 s);
              rest = lib.substring 1 (-1) s;

            in
            # matched = builtins.match "(.)(.*)" s;
            # firstChar = f (lib.elemAt matched 0);
            # rest = lib.elemAt matched 1;
            firstChar + rest;

          toCamelCase_ =
            sep: s:
            mutFirstChar lib.toLower (lib.concatMapStrings (mutFirstChar lib.toUpper) (lib.splitString sep s));

          toCamelCase =
            s:
            builtins.foldl' (s: sep: toCamelCase_ sep s) s [
              "-"
              "_"
              "."
            ];

          nodeCorepackShims = pkgs.stdenv.mkDerivation {
            name = "corepack-shims";
            buildInputs = [ pkgs.nodejs ];
            phases = [ "installPhase" ];
            installPhase = ''
              mkdir -p $out/bin
              corepack enable --install-directory=$out/bin
            '';
          };

          mkNodeShell =
            name:
            let
              node = pkgs.${name};
              corepackShim = nodeCorepackShims.overrideAttrs (_: {
                buildInputs = [ node ];
              });
            in
            pkgs.mkShell {
              description = "${name} Development Environment";
              buildInputs = [
                node
                corepackShim
              ];
            };

          mkGoShell =
            name:
            let
              go = pkgs.${name};
            in
            pkgs.mkShell {
              description = "${name} Development Environment";
              buildInputs = [ go ];
              shellHook = ''
                export GOPATH="$(${go}/bin/go env GOPATH)"
                export PATH="$PATH:$GOPATH/bin"
              '';
            };

          mkShell =
            pkgName: name:
            if lib.strings.hasPrefix "nodejs_" pkgName then
              mkNodeShell name
            else if lib.strings.hasPrefix "go_" pkgName then
              mkGoShell name
            else
              builtins.throw "Unknown package ${pkgName} for making shell environment";

          mkShells =
            pkgName:
            let
              mkShell_ = mkShell pkgName;
            in
            builtins.foldl' (acc: name: acc // { "${toCamelCase name}" = mkShell_ name; }) { } (
              builtins.filter (lib.strings.hasPrefix pkgName) (builtins.attrNames pkgs)
            );

        in
        ####################################################################################################
        #    see nodejs_* definitions in {https://search.nixos.org/packages?query=nodejs_}
        #
        #    versions: 14, 18, 20, 22, Latest
        #
        #    $ nix develop github:r17x/nixpkgs#<nodejsVERSION>
        #
        #
        mkShells "nodejs_"
        // mkShells "go_"
        // {
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
            let
              ocamlPackages = pkgs.ocaml-ng.ocamlPackages_4_14;
            in
            pkgs.mkShell {
              description = "OCaml.org development environment";
              buildInputs = with ocamlPackages; [
                ocaml
                merlin
              ];
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
            shellHook = config.pre-commit.installationScript;
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
              dream
              melange
              melange-webapi
              reason-react
              reason-react-ppx
              server-reason-react
              atdgen
              atdgen-runtime
              yojson
              lwt
              lwt_ppx
              cohttp
              cohttp-lwt-unix
              # TODO: styled-ppx fix build
              # styled-ppx
              pkgs.nodejs_20
              (nodeCorepackShims.overrideAttrs (_: {
                buildInputs = [ pkgs.nodejs_20 ];
              }))
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

            nativeBuildInputs = with pkgs; [
              rustc
              cargo
              gcc
              rustfmt
              clippy
            ];
          };

          #
          #
          #    $ nix develop github:r17x/nixpkgs#bun
          #
          #
          bun = pkgs.mkShell { buildInputs = [ pkgs.bun ]; };
        };

    };
}
