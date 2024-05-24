{ pkgs, ... }:

let
  inherit (pkgs.stdenv) isDarwin;
in
{
  # Packages with configuration --------------------------------------------------------------- {{{
  programs.home-manager.enable = true;

  # Bat, a substitute for cat.
  # https://github.com/sharkdp/bat
  # https://rycee.gitlab.io/home-manager/options.html#opt-programs.bat.enable
  programs.bat.enable = true;
  programs.bat.config = {
    style = "plain";
    theme = "TwoDark";
  };
  # Direnv, load and unload environment variables depending on the current directory.

  # https://direnv.net
  # https://rycee.gitlab.io/home-manager/options.html#opt-programs.direnv.enable
  programs.direnv.enable = true;
  programs.direnv.nix-direnv.enable = true;

  # Htop
  # https://rycee.gitlab.io/home-manager/options.html#opt-programs.htop.enable
  programs.htop.enable = true;
  programs.htop.settings.show_program_path = true;

  home.packages = with pkgs;
    [
      ################################## 
      # common
      ################################## 
      coreutils
      curl
      wget
      tree
      gnupg # required for pass git
      # pass # password management
      ack
      fswatch

      ################################## 
      # Platform specific
      ################################## 
      asciinema # screen record
      # glab # gitlab cli
      # nodePackages.svg-term-cli
      # nodePackages."@napi-rs/cli"
      # nodePackages.mrm

      ################################## 
      # Productivity
      ################################## 
      fzf # finder
      fzy
      neofetch # fancy fetch information
      du-dust # fancy du
      fd # fancy find
      jq # JSON in shell
      ripgrep # another yet of grep
      ffmpeg
      imagemagick

      ################################## 
      # Development
      ################################## 
      # podman
      # podman-compose
      colima
      docker
      qemu
      babelfish
      paperkey
      # yarn # currently defined in devShell.nix
      tokei
      # google-cloud-sdk
      # nodejs-16_x
      # gitlab-runner
      comby
      mob
      # openvpn # currently not used

      ################################## 
      # Shell Integrations
      ################################## 
      starship # theme for shell (bash,fish,zsh)

      ################################## 
      # Misc
      ################################## 
      # spotifyd # spotify daemon for TUI
      # spotify-tui # spotify terminal UI
      obs-studio

      ################################## 
      # Communication
      ################################## 
      discord-ptb
      slack
      zoom-us
      ################################## 
      # Useful Nix related tools
      ################################## 
      cachix
      comma # run without install
      # nodePackages.node2nix # use with comma 
      # rnix-lsp # use in neovim and install with nvim-lsp-install
      nix-prefetch-git
      # nodePackages.node2nix # use with comma 
      # yarn2nix
    ] ++ lib.optionals isDarwin [
      mas
      # orbstack # UNSTABLE, may be install in System (NEED Root)
      xbar
      (rectangle.overrideAttrs (_: rec {
        version = "0.73";
        src = fetchurl {
          url = "https://github.com/rxhanson/Rectangle/releases/download/v${version}/Rectangle${version}.dmg";
          hash = "sha256-D+heCrJVo2xsKY9XtEuhrG/59yFIJTGhKJIfN9Vhc+M=";
        };
      }))
      cocoapods
      m-cli # useful macOS CLI commands
      xcode-install
      telegram
      # iriun-webcam
      clipy
      # googlechrome
    ];
}
