{ ... }:
{
  den.aspects.mouseless = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/mouseless.nix ];
    };
  };
}
