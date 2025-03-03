{
  imports = [
    # extends darwinConfigurations/eR17.nix
    (import ./eR17.nix)
  ];

  documentation.enable = false;

  services = {
    yggdrasil.enable = false;
    dnscrypt-proxy.enable = true;
    # when unbound `false` need to change dnscrypt listen address:
    # dnscrypt-proxy.settings.listen_adresses = [ "127.0.0.1:53" ]
    unbound.enable = true;
    tailscale.enable = true;
  };

  networking = {
    hostName = "eR17x";
    knownNetworkServices = [ "Wi-Fi" ];
  };

  # --- linux-builder
  nix.linux-builder.enable = true;
}
