{ ... }:
{
  den.aspects.homebrew = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/homebrew.nix ];
    };
  };
}
