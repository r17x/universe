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
    # common
    coreutils
    curl
    wget
    tree
    gnupg # required for pass git
    pass # password management

    # fancy
    neofetch
    # fancy du
    du-dust
    # fancy find
    fd
    # fancy cat
    bat
    # git
    glab # gitlab cli
    gh # github cli
    # Manager
    yadm
    # Productivity
    fzf
    jq
    fish
    direnv
    thefuck

    # Development
    neovim
    yarn
    tokei
    rustPackages.rustc
    rustPackages.rustfmt
    rustPackages.cargo
    google-cloud-sdk

    # Shell Integrations
    tmux
    ripgrep
    starship

    spotifyd # spotify
    spotify-tui

    # Useful nix related tools
    cachix
    comma # run without install
  ] ++ lib.optionals stdenv.isDarwin [
    cocoapods
    m-cli # useful macOS CLI commands
    pinentry_mac # gpg-agent for mac
  ];
}
