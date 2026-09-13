{ ... }:
{
  den.aspects.home-gpg = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/gpg.nix ];
    };
  };
}
