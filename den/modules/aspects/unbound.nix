{ ... }:
{
  den.aspects.unbound = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/unbound.nix ];
    };
  };
}
