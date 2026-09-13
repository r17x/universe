{ ... }:
{
  den.aspects.darwin-packages = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/packages.nix ];
    };
  };
}
