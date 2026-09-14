{ den, ... }:
{
  den.aspects.eR17x = {
    includes = [
      den.aspects.eR17
      den.aspects.network
      den.aspects.unbound
      den.aspects.yggdrasil
      den.aspects.linux-builder
    ];

    darwin = _: {
      documentation.enable = false;

      services = {
        yggdrasil.enable = false;
        dnscrypt-proxy.enable = true;
        unbound.enable = true;
        tailscale.enable = true;
      };

      networking = {
        dns = [ "127.0.0.1" ];
        knownNetworkServices = [ "Wi-Fi" ];
      };

      nix.linux-builder.enable = true;
    };
  };
}
