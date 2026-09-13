{ ... }:
{
  den.aspects.home-packages = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/packages.nix ];
    };
  };
}
