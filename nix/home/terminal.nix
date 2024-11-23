/*
  Usage in `home-manager`:

    ```nix
    imports = [ inputs.r17x.homeManagerModules.terminal ];

    programs.terminal.use = "ghostty"
    ```
*/

{
  color,
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
        background = color.scheme.base00;
        foreground = color.scheme.base07;
        selection-background = color.scheme.base08;
        selection-foreground = color.scheme.base0F;
        cursor-color = color.scheme.base06;
        cursor-text = color.scheme.base07;
        cursor-style = "underline";
        cursor-style-blink = true;
        palette = color.listKV;
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
