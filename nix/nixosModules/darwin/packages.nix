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
  fonts.fontDir.enable = true;
  fonts.fonts = [
    pkgs.sketchybar-app-font

    # name of nerdfonts see {https://github.com/NixOS/nixpkgs/blob/nixos-24.05/pkgs/data/fonts/nerdfonts/shas.nix}
    (pkgs.nerdfonts.override {
      fonts = [
        "JetBrainsMono"
        "FiraCode"
        "Hack"
        "NerdFontsSymbolsOnly"
      ];
    })

    (pkgs.stdenvNoCC.mkDerivation rec {
      pname = "sf-mono-liga-bin";
      version = "7723040ef50633da5094f01f93b96dae5e9b9299";

      src = pkgs.fetchFromGitHub {
        owner = "shaunsingh";
        repo = "SFMono-Nerd-Font-Ligaturized";
        rev = version;
        sha256 = "sha256-vPUl6O/ji4hHIH7/qSbUe7q1QdugE1D1ZRw92QcSSDQ=";
      };

      dontConfigure = true;
      installPhase = ''
        mkdir -p $out/share/fonts/opentype
        cp -R $src/*.otf $out/share/fonts/opentype
      '';
    })
  ];
}
