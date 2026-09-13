{ ... }:
{
  den.aspects.home-shells = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/shells.nix ];
    };
  };
}
