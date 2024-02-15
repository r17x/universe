{ pkgs, lib, ... }:
{
  # https://github.com/nix-community/home-manager/issues/423
  programs.nix-index.enable = true;
  # Nix configuration ------------------------------------------------------------------------------

  # Bootstrap
  nix = {
    configureBuildUsers = true;
    settings = {
      auto-optimise-store = true;

      trusted-users = [
        "@admin"
        "r17"
      ];

      substituters = [
        "https://cache.komunix.org"
        "https://nix-community.cachix.org"
        "https://r17.cachix.org/"
        "https://efishery.cachix.org"
      ];


      trusted-public-keys = [
        "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
        "r17.cachix.org-1:vz0nG6BCbdgTPn7SEiOwe/3QwvjH1sb/VV9WLcBtkAY="
        "efishery.cachix.org-1:ix7pi358GsGkH7oBTmKGkVj42yBcjxRPi6IQ9AbRc0o="
      ];
    };


    # enable garbage-collection on weekly and delete-older-than 30 day
    gc = {
      automatic = true;
      options = "--delete-older-than 30d";
    };

    # this is configuration for /etc/nix/nix.conf
    # so it will generated /etc/nix/nix.conf
    extraOptions = ''
      experimental-features = nix-command flakes
      keep-outputs = true
      keep-derivations = true
    '' + lib.optionalString (pkgs.system == "aarch64-darwin") ''
      extra-platforms = x86_64-darwin aarch64-darwin
    '';
  };

  system = {
    # Used for backwards compatibility, please read the changelog before changing.
    # $ darwin-rebuild changelog
    stateVersion = 4;
    # Keyboard
    keyboard.enableKeyMapping = true;
    keyboard.remapCapsLockToEscape = true;
    # Add ability to used TouchID for sudo authentication
  };
}
