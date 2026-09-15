{ ... }:
{
  den.aspects.packages = {
    darwin =
      {
        config,
        lib,
        pkgs,
        ...
      }:

      let
        brewEnabled = config.homebrew.enable;
      in
      {

        environment.systemPackages = with pkgs.branches.master; [
          raycast
          terminal-notifier
        ];

        fonts.packages = with pkgs; [
          kode-mono
          sketchybar-app-font
          sf-mono-liga-bin
          sf-symbols-font

          nerd-fonts.jetbrains-mono
          nerd-fonts.fira-code
          nerd-fonts.hack
          nerd-fonts.symbols-only
          geist-font
        ];

        environment.shellInit =
          lib.mkIf brewEnabled # bash
            ''
              eval "$(${config.homebrew.brewPrefix}/brew shellenv)"
            '';

        homebrew.enable = true;
        homebrew.brews = [ ];
        homebrew.onActivation.cleanup = "zap";
        homebrew.global.brewfile = true;

        homebrew.masApps = {
          Vimari = 1480933944;
          WhatsApp = 310633997;
        };

        homebrew.casks = [ ];
      };

    homeManager =
      { pkgs, lib, ... }:
      {
        programs.home-manager.enable = true;

        programs.nix-index.enable = true;

        programs.bat.enable = true;
        programs.bat.config = {
          style = "plain";
          theme = "TwoDark";
        };

        programs.direnv.enable = true;
        programs.direnv.silent = true;
        programs.direnv.nix-direnv.enable = true;

        programs.btop.enable = true;
        programs.btop.settings = {
          vim_keys = true;
          show_battery = false;
        };

        home.packages =
          with pkgs;
          [
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

            asciinema

            fzf
            fzy
            du-dust
            fd
            jq
            ripgrep
            ffmpeg
            imagemagick

            docker

            starship

            (pkgs.branches.stable.discord.override {
              withVencord = true;
              withOpenASAR = true;
            })

            slack
            iamb
            telegram-desktop

            cachix
            comma
          ]
          ++ lib.optionals stdenv.isDarwin [
            mas
            m-cli
            clipy
          ];
      };
  };
}
