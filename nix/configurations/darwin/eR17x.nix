{ lib, ... }:
{
  imports = [ (import ./eR17.nix) ];

  documentation.enable = false;

  services = {
    yggdrasil.enable = false;
    dnscrypt-proxy.enable = true;
    unbound.enable = true;
    tailscale.enable = lib.mkDefault true;
  };

  networking = {
    dns = [ "127.0.0.1" ];
    knownNetworkServices = [ "Wi-Fi" ];
  };

  # --- linux-builder
  nix.linux-builder.enable = lib.mkDefault true;
}
