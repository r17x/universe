/*
  Usage in `home-manager`:

    ```nix
    imports = [ inputs.r17x.homeManagerModules.terminal ];

    programs.terminal.use = "ghostty"
    ```
*/

{
  lib,
  config,
  pkgs,
  ...
}:

let
  cfg = config.programs.terminal;
in

{
  options = {
    programs.terminal = {
      use = lib.mkOption {
        default = "none";
        type = lib.types.enum [
          "none"
          "alacritty"
          "ghostty"
        ];
        description = "Select terminal to use `alacritty` or `ghostty`";
      };
    };
  };

  config = {
    xdg.configFile."ghostty/config".source = lib.mkIf (cfg.use == "ghostty") (
      let
        formatter = pkgs.formats.keyValue {
          listsAsDuplicateKeys = true;
        };
      in
      formatter.generate "config" {
        desktop-notifications = true;
        confirm-close-surface = false;
        shell-integration = "fish";
        custom-shader-animation = true;
        window-decoration = false;
        window-padding-x = 8;
        window-padding-y = 5;
        window-padding-color = "background";
        theme = "zenwritten_dark";
        bold-is-bright = true;
        background-opacity = 1;
        background = "#2B2D3A";
        foreground = "#bbbbbb";
        selection-background = "#404040";
        selection-foreground = "#bbbbbb";
        cursor-color = "#5DBBC1";
        cursor-text = "#FFFFFF";
        cursor-style = "underline";
        cursor-style-blink = true;
        palette =
          [
            "#191919"
            "#de6e7c"
            "#819b69"
            "#b77e64"
            "#6099c0"
            "#b279a7"
            "#66a5ad"
            "#bbbbbb"
            "#3d3839"
            "#e8838f"
            "#8bae68"
            "#d68c67"
            "#61abda"
            "#cf86c1"
            "#65b8c1"
            "#8e8e8e"
          ]
          |> lib.lists.imap0 (a: b: "${toString a}=${b}");
        cursor-click-to-move = false;
        macos-window-shadow = false;
        macos-titlebar-style = "transparent";
        font-feature = "JetBrainsMono Nerd Font Mono";
        font-family = "FiraCode Nerd Font Mono ";
        font-thicken = true;
      }
    );

    programs.alacritty = lib.mkIf (cfg.use == "alacritty") {
      enable = true;
      package = pkgs.alacritty;
      settings = {
        window = {
          dimensions = {
            columns = 0;
            lines = 0;
          };
          padding = {
            x = 0;
            y = 0;
          };
          background_opacity = 0.95;
          startup_mode = ''Windowed'';
        };
      };
    };
  };
}
