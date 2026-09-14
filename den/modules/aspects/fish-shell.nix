{ ... }:
{
  den.aspects.fish-shell = {
    darwin = _: {
      imports = [ ../../../nix/modules/cross/shells.nix ];
    };
    nixos = _: {
      imports = [ ../../../nix/modules/cross/shells.nix ];
    };
  };
}
