{ ... }:
{
  den.aspects.mail = {
    homeManager = _: {
      imports = [ ../../../nix/modules/home/mail.nix ];
    };
  };
}
