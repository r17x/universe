##################################################################
#                       Development shells
##################################################################
{ inputs, ... }:

{
  imports = [
    inputs.pre-commit-hooks.flakeModule
  ];

  perSystem =
    {
      inputs',
      self',
      pkgs,
      config,
      system,
      ...
    }:
    {
      pre-commit.check.enable = true;
      pre-commit.devShell = self'.devShells.default;
      pre-commit.settings.hooks = {
        actionlint.enable = true;
        shellcheck.enable = true;
        stylua.enable = true;
        luacheck.enable = false;
        deadnix.enable = true;
        deadnix.excludes = [ "nix/overlays/nodePackages/node2nix" ];
        nixfmt-rfc-style.enable = true;
        dune-fmt.enable = true;
        dune-fmt.settings.extraRuntimeInputs = [ pkgs.ocamlPackages.ocamlformat ];
        dune-fmt.files = "apps/rin.rocks";
        dune-fmt.entry = "dune build @fmt --root=apps/rin.rocks --auto-promote";
        oxlint = {
          enable = true;
          name = "oxlint";
          entry = "${pkgs.oxlint}/bin/oxlint --ignore-path .gitignore";
          files = "\\.(ts|tsx|js|jsx)$";
          pass_filenames = false;
          language = "system";
        };
        oxfmt = {
          enable = true;
          name = "oxfmt";
          entry = "${pkgs.bun}/bin/bun x oxfmt apps/anakmagang/src -- --check";
          files = "\\.(ts|tsx|js|jsx)$";
          pass_filenames = false;
          language = "system";
        };
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

          mkNodeShell =
            name:
            let
              node = pkgs.${name};
              corepackShim = pkgs.nodeCorepackShims.overrideAttrs (_: {
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
              builtins.filter (
                name: lib.strings.hasPrefix pkgName name && (builtins.tryEval pkgs.${name}).success
              ) (builtins.attrNames pkgs)
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
            packages = [ ];
          };

          #
          #
          #    $ nix develop github:r17x/nixpkgs#ocaml
          #
          #
          rescript-compiler = pkgs.mkShell {
            description = "OCaml development environment";
            packages = [
              pkgs.opam
              pkgs.python3
              (pkgs.nodeCorepackShims.overrideAttrs (_: {
                buildInputs = [ pkgs.nodejs ];
              }))
              pkgs.nodejs
              pkgs.dune_3
            ];
            inputsFrom = [ self'.devShells.rust-wasm ];
            shellHook = ''
              eval $(opam env --switch=default)
            '';
          };

          ocaml =
            let
              ocamlPackages = pkgs.ocaml-ng.ocamlPackages_5_1;
            in
            pkgs.mkShell {
              description = "OCaml development environment";
              buildInputs = [
                # this needed for common HTTP libraries
                pkgs.openssl
                pkgs.libev
                pkgs.pkgconf
                pkgs.pkg-config
                # pkgs.ocamlformat
                pkgs.opam

                ocamlPackages.ocaml
                ocamlPackages.dune_3
                # ocamlPackages.ocaml-lsp
                # ocamlPackages.merlin
                # ocamlPackages.merlin-extend
                # ocamlPackages.utop
                # ocamlPackages.odoc
                # ocamlPackages.ocp-indent
                # ocamlPackages.findlib
              ];
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
              openssl
              pkg-config
            ];
          };

          rust-cap = pkgs.mkShell {
            description = "Rust  Development Environment";
            # declared ENV variables when starting shell
            RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";

            shellHook =
              ''
                export PATH=$PATH:''${CARGO_HOME:-~/.cargo}/bin
              ''
              + lib.optionalString pkgs.stdenv.isDarwin ''
                export NIX_LDFLAGS="-F${pkgs.darwin.apple_sdk.frameworks.CoreFoundation}/Library/Frameworks -framework CoreFoundation $NIX_LDFLAGS";

              '';

            nativeBuildInputs =
              with pkgs;
              [
                rustup
                rustc
                cargo
                rustfmt
                clippy
                ffmpeg
              ]
              ++ lib.optionals pkgs.stdenv.isDarwin (
                with pkgs.darwin.apple_sdk;
                [
                  pkgs.libiconv
                  pkgs.pkg-config
                  frameworks.Security
                  frameworks.SystemConfiguration
                  frameworks.CoreFoundation
                  frameworks.Cocoa
                  frameworks.CoreMedia
                  frameworks.Metal
                  frameworks.AVFoundation
                  frameworks.WebKit
                  pkgs.darwin.apple_sdk_12_3.frameworks.ScreenCaptureKit
                ]
              );
          };

          #
          #
          #    $ nix develop github:r17x/nixpkgs#anakmagang
          #
          #
          anakmagang = pkgs.mkShell {
            LIBFFF_PATH = "${pkgs.fff-nvim}/lib";
            description = "Anakmagang CLI Development Environment";
            inputsFrom = [ self'.devShells.default ];
            shellHook = ''
              ${config.pre-commit.installationScript}

              export ROOT_REPO=$(git rev-parse --show-toplevel)
              export ANAKMAGANG_PATH="$ROOT_REPO/apps/anakmagang"

              build-anakmagang
              export PATH="$ROOT_REPO:$PATH:$ANAKMAGANG_PATH/node_modules/.bin"
            '';

            packages = [
              pkgs.bun
              (pkgs.writeShellScriptBin "bunx" ''exec bun --bun x "$@"'')
              (pkgs.writeShellScriptBin "build-anakmagang" ''
                set -euo pipefail
                ROOT_REPO="$(git rev-parse --show-toplevel)"
                ANAKMAGANG_PATH="$ROOT_REPO/apps/anakmagang"
                cd "$ANAKMAGANG_PATH" && ${pkgs.bun}/bin/bun install
                cd "$ANAKMAGANG_PATH" && OUTFILE="$ROOT_REPO/anakmagang" ${pkgs.bun}/bin/bun run build.ts
                cd "$ROOT_REPO"
              '')
              (pkgs.writeShellScriptBin "browser" ''
                DIA_APP="/Applications/Dia.app"
                CDP_PORT=9222

                if pgrep -f "remote-debugging-port=$CDP_PORT" > /dev/null 2>&1; then
                  echo "Dia is already running with CDP enabled."
                  echo "CDP endpoint: cdp://localhost:$CDP_PORT"
                elif pgrep -f "Dia" > /dev/null 2>&1; then
                  echo "WARNING: Dia is running but WITHOUT CDP enabled."
                  echo "Restarting Dia with CDP..."
                  pkill -f "Dia"
                  sleep 1
                  open -a "$DIA_APP" --args --remote-debugging-port=$CDP_PORT
                  echo "Dia relaunched with CDP."
                  echo "CDP endpoint: cdp://localhost:$CDP_PORT"
                else
                  echo "Launching Dia with CDP enabled..."
                  open -a "$DIA_APP" --args --remote-debugging-port=$CDP_PORT
                  echo "CDP endpoint: cdp://localhost:$CDP_PORT"
                fi
              '')
              inputs.bun2nix.packages.${system}.default
              pkgs.typescript
              pkgs.fff-nvim
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
