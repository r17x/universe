{ den, ... }:
{
  den.aspects.packages = {
    includes = with den.aspects.packages.provides; [
      system
      fonts
      homebrew
      user
      user-darwin
    ];

    provides.system = {
      darwin =
        { pkgs, ... }:
        {
          environment.systemPackages = with pkgs.branches.master; [
            raycast
            terminal-notifier
          ];
        };
    };

    provides.fonts = {
      darwin =
        { pkgs, ... }:
        {
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
        };
    };

    provides.homebrew = {
      darwin =
        { host, config, ... }:
        {
          environment.shellInit = ''
            eval "$(${config.homebrew.brewPrefix}/brew shellenv)"
          '';

          homebrew.enable = true;
          homebrew.brews = [ ];
          homebrew.onActivation.cleanup = "zap";
          homebrew.global.brewfile = true;

          homebrew.masApps = host.apps.masApps;

          homebrew.casks = [ ];
        };
    };

    provides.user =
      { user, ... }:
      {
        homeManager =
          { pkgs, ... }:
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

            home.packages = with pkgs; [
              (writeScriptBin "copy" (if stdenv.hostPlatform.isDarwin then "pbcopy" else "xsel -ib"))
              (writeScriptBin "paste" (if stdenv.hostPlatform.isDarwin then "pbpaste" else "xsel -ob"))

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

              (pkgs.branches.stable.discord.override (user.packageOverrides.discord or { }))

              slack
              iamb
              telegram-desktop

              cachix
              comma
            ];
          };
      };

    provides.user-darwin = {
      homeManager =
        { pkgs, ... }:
        {
          home.packages = with pkgs; [
            mas
            m-cli
            clipy
          ];
        };
    };
  };
}
