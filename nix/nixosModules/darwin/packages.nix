# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{ pkgs, ... }:

{
  # Apps
  environment.systemPackages = with pkgs; [
    iterm2
    terminal-notifier
    darwin.cf-private
    darwin.apple_sdk.frameworks.CoreServices
  ];

  # Fonts
  fonts.packages = [
    pkgs.sketchybar-app-font
    pkgs.sf-mono-liga-bin

    # name of nerdfonts see {https://github.com/NixOS/nixpkgs/blob/nixos-24.05/pkgs/data/fonts/nerdfonts/shas.nix}
    (pkgs.nerdfonts.override {
      fonts = [
        "JetBrainsMono"
        "FiraCode"
        "Hack"
        "NerdFontsSymbolsOnly"
      ];
    })
  ];
}
