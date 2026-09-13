{ ... }:
{
  den.aspects.nix-settings = {
    darwin = _: {
      imports = [ ../../../nix/modules/cross/nix.nix ];
    };
    nixos = _: {
      imports = [ ../../../nix/modules/cross/nix.nix ];
    };
  };
}
