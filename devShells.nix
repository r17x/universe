{ pkgs, precommit }:
{

  # `nix develop my`.
  default = pkgs.mkShell {
    description = "r17x/nixpkgs development environment";
    shellHook = precommit.shellHook or '''';
    buildInputs = precommit.buildInputs or [ ];
    packages = precommit.packages or [ ];
  };

  node18 = pkgs.mkShell {
    description = "Node.js 18 Development Environment";
    buildInputs = with pkgs; [
      nodejs_18
      (nodePackages.yarn.override { nodejs = nodejs_18; })
    ];
  };

  # this development shell use for ocaml.org
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

  pnpm = pkgs.mkShell {
    description = "Nodejs with PNPM";

    buildInputs = with pkgs; [
      nodejs_18
      (nodePackages.pnpm.override { nodejs = nodejs_18; })
    ];
  };

}
