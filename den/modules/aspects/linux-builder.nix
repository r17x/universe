{ ... }:
{
  den.aspects.linux-builder = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/linux-builder.nix ];
    };
  };
}
