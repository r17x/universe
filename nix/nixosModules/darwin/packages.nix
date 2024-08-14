# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{ pkgs, ... }:

{
  # Apps
  environment.systemPackages = with pkgs; [
    raycast
    iterm2
    terminal-notifier
  ];

  # Fonts
  fonts.packages = with pkgs; [
    sketchybar-app-font
    sf-mono-liga-bin
    sf-symbols-font

    # name of nerdfonts see {https://github.com/NixOS/nixpkgs/blob/nixos-24.05/pkgs/data/fonts/nerdfonts/shas.nix}
    (nerdfonts.override {
      fonts = [
        "JetBrainsMono"
        "FiraCode"
        "Hack"
        "NerdFontsSymbolsOnly"
      ];
    })
  ];
}
