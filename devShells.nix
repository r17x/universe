##################################################################
#                       Development shells
##################################################################
{ pkgs, precommit }:

{
  #
  #
  #    $ nix develop github:r17x/nixpkgs
  #
  #
  default = pkgs.mkShell {
    description = "r17x/nixpkgs development environment";
    shellHook = precommit.shellHook or '''';
    buildInputs = precommit.buildInputs or [ ];
    packages = precommit.packages or [ ];
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
  #    $ nix develop github:r17x/nixpkgs#rust-wasm
  #
  #
  rust-wasm = pkgs.mkShell {
    # declared ENV variables when starting shell
    RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";

    nativeBuildInputs = with pkgs; [ rustc cargo gcc rustfmt clippy ];
  };
}
