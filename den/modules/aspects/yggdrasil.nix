{ ... }:
{
  den.aspects.yggdrasil = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/yggdrasil.nix ];
    };
  };
}
