{ config, pkgs, lib, ... }:

{
  # Packages with configuration --------------------------------------------------------------- {{{

  # Golang
  programs.go.enable = true;

  # Bat, a substitute for cat.
  # https://github.com/sharkdp/bat
  # https://rycee.gitlab.io/home-manager/options.html#opt-programs.bat.enable
  programs.bat.enable = true;
  programs.bat.config = {
    style = "plain";
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

  # home.file.".gnupg/gpg-agent.conf" = {
  #   target = ".gnupg/gpg-agent.conf";
  #   text = ''
  #   pinentry-program ${pkgs.pinentry_mac}/pinentry-mac.app/Contents/MacOS/pinentry-mac
  # '';
  # };
  home.packages = with pkgs; [
    ################################## 
    # common
    ################################## 
    coreutils
    curl
    wget
    tree
    gnupg # required for pass git
    pass # password management
    ack

    ################################## 
    # Platform specific
    ################################## 
    asciinema # screen record
    glab # gitlab cli
    gh # github cli
    nodePackages.svg-term-cli

    ################################## 
    # Manager
    ################################## 
    yadm

    ################################## 
    # Productivity
    ################################## 
    fzf # finder
    neofetch # fancy fetch information
    du-dust # fancy du
    fd # fancy find
    jq # JSON in shell
    ripgrep # another yet of grep
    thefuck # hints command
    ffmpeg
    imagemagick

    ################################## 
    # Development
    ################################## 
    git
    neovim
    yarn
    tokei
    rustPackages.rustc
    rustPackages.rustfmt
    rustPackages.cargo
    google-cloud-sdk
    nodejs-16_x
    gitlab-runner
    comby
    python3
    pkg-config

    ################################## 
    # Shell Integrations
    ################################## 
    tmux # terminal multi-plexer (multiply terminal)
    starship # theme for shell (bash,fish,zsh)

    ################################## 
    # Misc
    ################################## 
    spotifyd # spotify daemon for TUI
    spotify-tui # spotify terminal UI

    ################################## 
    # Useful Nix related tools
    ################################## 
    cachix
    comma # run without install
    nodePackages.node2nix
    nix-prefetch-git
  ] ++ lib.optionals stdenv.isDarwin [
    cocoapods
    m-cli # useful macOS CLI commands
    pinentry_mac # gpg-agent for mac
    xcode-install
  ];
}
