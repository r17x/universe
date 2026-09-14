{ ... }:
{
  den.aspects.activation = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/activation.nix ];
    };
  };
}
