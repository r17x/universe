{ pkgs, ... }:

{
  # Packages with configuration --------------------------------------------------------------- {{{
  programs.home-manager.enable = true;

  programs.nix-index.enable = true;

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
  programs.direnv.silent = true;
  programs.direnv.nix-direnv.enable = true;

  # Htop
  # https://rycee.gitlab.io/home-manager/options.html#opt-programs.btop.enable
  programs.btop.enable = true;
  programs.btop.settings = {
    vim_keys = true;
    show_battery = false;
  };

  home.packages =
    with pkgs;
    [
      ################################## 
      # common
      ################################## 
      (writeScriptBin "copy" (if stdenv.isDarwin then "pbcopy" else "xsel -ib"))
      (writeScriptBin "paste" (if stdenv.isDarwin then "pbpaste" else "xsel -ob"))

      coreutils
      gnused
      gawk

      curl
      wget
      tree
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
      du-dust # fancy du
      fd # fancy find
      jq # JSON in shell
      ripgrep # another yet of grep
      ffmpeg
      imagemagick

      ################################## 
      # Development
      ################################## 
      docker

      ################################## 
      # Shell Integrations
      ################################## 
      starship # theme for shell (bash,fish,zsh)

      ################################## 
      # Misc
      ################################## 
      # spotifyd # spotify daemon for TUI
      # spotify-tui # spotify terminal UI

      ################################## 
      # Communication
      ################################## 
      discord-ptb
      # issue > cp: target 'PTB.app/Contents/Resources/app.asar': No such file or directory 
      ## (branches.stable.discord-ptb.override {
      ##   withVencord = true;
      ##   withOpenASAR = true;
      ## })

      slack
      zoom-us
      iamb
      telegram-desktop

      ################################## 
      # Useful Nix related tools
      ################################## 
      manix
      cachix
      comma # run without install
    ]
    ++ lib.optionals stdenv.isDarwin [
      mas
      m-cli # useful macOS CLI commands
      clipy
    ];
}
