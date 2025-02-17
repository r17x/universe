{
  inputs,
  lib,
  pkgs,
  ezModules,
  ...
}:

{
  imports = lib.attrValues (ezModules // inputs.self.nixosModules);

  system.stateVersion = 4;
  nixpkgs.hostPlatform = "aarch64-darwin";

  users.users.r17 = {
    home = "/Users/r17";
    shell = pkgs.fish;
  };

  services = {
    yggdrasil.enable = false;
    dnscrypt-proxy.enable = true;
    # when unbound `false` need to change dnscrypt listen address:
    # dnscrypt-proxy.settings.listen_adresses = [ "127.0.0.1:53" ]
    unbound.enable = true;
    tailscale.enable = true;
  };

  # --- see: nix/nixosModules/nix.nix
  nix-settings = {
    enable = true;
    use = "full";
    inputs-to-registry = true;
  };

  # --- see: nix/darwinModules/mouseless.nix
  mouseless.enable = true;
  mouseless.wm = "aerospace";

  # --- nix-darwin
  homebrew.enable = true;

  networking.hostName = "eR17x";
  networking.computerName = "eR17x";
  networking.knownNetworkServices = [ "Wi-Fi" ];

  # --- linux-builder
  nix.linux-builder.enable = true;
  # set authorized ssh keys
  nix.linux-builder.config.users.users.root.openssh.authorizedKeys.keys = inputs.self.users.r17.keys;

  documentation.enable = false;
}
