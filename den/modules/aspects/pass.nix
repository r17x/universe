{ ... }:
{
  den.aspects.pass = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/pass.nix ];
    };
  };
}
