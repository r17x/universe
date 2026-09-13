{ ... }:
{
  den.aspects.tmux = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/tmux.nix ];
    };
  };
}
