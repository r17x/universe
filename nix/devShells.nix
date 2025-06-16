##################################################################
#                       Development shells
##################################################################
{ inputs, self, ... }:

{
  imports = [
    inputs.pre-commit-hooks.flakeModule
  ];

  perSystem =
    {
      pkgs,
      system,
      config,
      self',
      ...
    }:
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
        nixfmt-rfc-style.enable = true;
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
        // rec {
          default = pkgs.mkShell {
            shellHook = ''
              ${config.pre-commit.installationScript}
            '';
            packages = [ inputs.clan-core.packages.${system}.clan-cli ];
          };

          #
          #
          #    $ nix develop github:r17x/nixpkgs#ocaml
          #
          #
          ocaml = pkgs.mkShell {
            description = "OCaml development environment";
            packages = [ pkgs.opam ];
          };

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

          rust-opencv = rust-wasm.overrideAttrs (old: {
            nativeBuildInputs = (old.nativeBuildInputs or [ ]) ++ [ pkgs.opencv4 ];
          });

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
          #    $ nix develop github:r17x/nixpkgs#bun
          #
          #
          bun = pkgs.mkShell { buildInputs = [ pkgs.bun ]; };
        };

    };
}
