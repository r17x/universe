{ ... }:
{
  den.aspects.network = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/network.nix ];
    };
  };
}
