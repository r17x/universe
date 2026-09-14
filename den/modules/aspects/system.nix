{ ... }:
{
  den.aspects.system = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/system.nix ];
    };
  };
}
