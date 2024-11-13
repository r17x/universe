{
  lib,
  stdenv,
  inputs,
  ...
}:

let
  nixPath = [ "nixpkgs=${inputs.nixpkgs}" ];
in
{
  inherit nixPath;

  configureBuildUsers = true;

  registry = {
    system.flake = inputs.self;
    default.flake = inputs.nixpkgs;
    nixpkgs.flake = inputs.nixpkgs;
    master.flake = inputs.nixpkgs-master;
    nix-darwin.flake = inputs.nix-darwin;
    home-manager.flake = inputs.home-manager;
  };

  settings =
    {
      nix-path = nixPath;
      auto-optimise-store = true;
      accept-flake-config = true;
      download-attempts = 3;
      fallback = true;
      http-connections = 0;
      max-jobs = "auto";

      experimental-features = [
        "pipe-operators"
        "auto-allocate-uids"
        "ca-derivations"
        "flakes"
        "nix-command"
      ];

      trusted-users = [
        "r17"
        "nixos"
        "root"
      ];

      trusted-substituters = [
        "https://cache.komunix.org"
        "https://nix-community.cachix.org"
        "https://r17.cachix.org/"
        "https://efishery.cachix.org"
      ];

      trusted-public-keys = [
        "efishery.cachix.org-1:ix7pi358GsGkH7oBTmKGkVj42yBcjxRPi6IQ9AbRc0o="
        "r17.cachix.org-1:vz0nG6BCbdgTPn7SEiOwe/3QwvjH1sb/VV9WLcBtkAY="
        "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
        "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
      ];
    }
    // (lib.optionalAttrs (stdenv.isDarwin && stdenv.isAarch64) {
      extra-platforms = "x86_64-darwin aarch64-darwin";
    });

  # enable garbage-collection on weekly and delete-older-than 30 day
  gc = {
    automatic = true;
    options = "--delete-older-than 30d";
  };

  # this is configuration for /etc/nix/nix.conf
  # so it will generated /etc/nix/nix.conf
  extraOptions = ''
    keep-outputs = true
    keep-derivations = true
    auto-allocate-uids = false
  '';
}
