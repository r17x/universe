{ ... }:
{
  flake.overlays.nodePackages = _final: prev: {
    nodeEnv = prev.callPackage ./node2nix/node-env.nix { };
    nodePackages = prev.nodePackages // (prev.callPackage ./node2nix { });
    nodeCorepackShims = prev.stdenv.mkDerivation {
      name = "corepack-shims";
      buildInputs = [ prev.nodejs ];
      phases = [ "installPhase" ];
      installPhase = ''
        mkdir -p $out/bin
        corepack enable --install-directory=$out/bin
      '';
    };
  };
}
