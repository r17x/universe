{ ... }:
{
  flake.overlays.nodePackages = _final: prev: {
    nodeEnv = prev.callPackage ./node2nix/node-env.nix { };
    nodePackages = prev.nodePackages // (prev.callPackage ./node2nix { });
  };
}
