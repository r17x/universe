{ ... }:
{
  den.aspects.darwin-gpg = {
    darwin = _: {
      imports = [ ../../../nix/modules/darwin/gpg.nix ];
    };
  };
}
