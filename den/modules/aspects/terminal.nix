{ ... }:
{
  den.aspects.terminal = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/terminal.nix ];
    };
  };
}
