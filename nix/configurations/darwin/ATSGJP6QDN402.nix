{ lib, ... }:

{
  imports = [ (import ./eR17x.nix) ];

  system.primaryUser = "rin";

  services = {
    tailscale.enable = false;
  };

  networking = {
    dns = [ "127.0.0.1" ];
    knownNetworkServices = [ "Wi-Fi" ];
  };

  nix.linux-builder.enable = false;
  homebrew.enable = lib.mkForce false;

  # Determinate Nix manages the daemon — disable nix-darwin's nix management
  nix.enable = lib.mkForce false;
  nix-settings.use = lib.mkForce "minimal";

  services.aerospace.settings.gaps.outer.top = lib.mkForce 17;
}
