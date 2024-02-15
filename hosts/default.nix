{ ... }:

let
  sharedModules = [
    ../shared/darwin/gpg.nix
    ../shared/darwin/homebrew.nix
    ../shared/darwin/network.nix
    ../shared/darwin/packages.nix
    ../shared/darwin/system.nix
  ];
in

{
  # nix-darwin configurations
  parts.darwinConfigurations = {
    # Apple M1
    eR17x = {
      system = "aarch64-darwin";
      stateVersion = 4;
      modules = sharedModules;
    };
  };

  # NixOS configurations
  # parts.nixosConfigurations = {
  #  linuxBased = {
  #    system = "x86_64-linux";
  #    stateVersion = "23.05";

  #    modules = [];
  #  };
  #  wsl2 = {
  #    system = "x86_64-linux";
  #    stateVersion = "22.05"; # only change this if you know what you are doing.
  #    wsl = true;

  #    modules = [ ];
  #  };
  #};
}
