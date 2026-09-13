{ ... }:
{
  den.aspects.git = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/git.nix ];
    };
  };
}
