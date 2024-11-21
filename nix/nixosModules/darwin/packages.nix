# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{
  lib,
  branches,
  pkgs,
  ...
}:

{
  # Apps
  environment.systemPackages = with branches.master; [
    raycast
    terminal-notifier
  ];

  system.activationScripts.postUserActivation.text =
    # install ghostty from github release
    # bash
    ''
      [[ ! -d ~/Applications/Ghostty.app ]] && cd /tmp && \
        ${lib.getExe pkgs.gh} release download -R mitchellh/ghostty tip -p 'ghostty-macos-universal.zip' --clobber && \
        rm -rf ~/Applications/Ghostty.app && \
        unzip -d ~/Applications ghostty-macos-universal.zip && \
        rm -f ghostty-macos-universal.zip || exit 0
    '';

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
