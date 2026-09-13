{ ... }:
let
  systemModule = _: {
    imports = [ ../../modules/cross/nix.nix ];
  };
in
{
  den.aspects.nix = {
    darwin = systemModule;
    nixos = systemModule;
  };
}
