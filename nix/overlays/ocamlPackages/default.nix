{ inputs, ... }:

{
  flake.overlays.ocamlPackages = _final: prev: {
    ocamlPackages = prev.ocaml-ng.ocamlPackages_5_2.overrideScope (
      ofinal: oprev: {
        quickjs = prev.callPackage ./quickjs.nix (oprev // { src = inputs.quickjs-ml; });
        server-reason-react = prev.callPackage ./server-reason-react.nix (
          ofinal // { src = inputs.server-reason-react; }
        );
        styled-ppx = prev.callPackage ./styled-ppx.nix (ofinal // { src = inputs.styled-ppx; });
      }
    );
  };
}
