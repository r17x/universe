# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{ pkgs, ... }:
{
  # Apps
  # `home-manager` currently has issues adding them to `~/Applications`
  # Issue: https://github.com/nix-community/home-manager/issues/1341
  environment.systemPackages = with pkgs; [
    # yggdrasil
    iterm2
    terminal-notifier
    darwin.cf-private
    darwin.apple_sdk.frameworks.CoreServices
  ];

  # something wrong
  # programs.tmux.iTerm2 = config.programs.tmux.enable;

  # Fonts
  fonts.fontDir.enable = true;
  fonts.fonts = [
    # name of nerdfonts see {https://github.com/NixOS/nixpkgs/blob/nixos-24.05/pkgs/data/fonts/nerdfonts/shas.nix}
    (pkgs.nerdfonts.override { fonts = [ "JetBrainsMono" "FiraCode" "Hack" "NerdFontsSymbolsOnly" ]; })
  ];

}
