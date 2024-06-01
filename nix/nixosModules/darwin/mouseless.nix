{ lib, config, pkgs, ... }:

with lib;

let
  cfg = config.mouseless;
in
{
  options.mouseless.enable = mkEnableOption (lib.mdDoc "Enable Mouseless with yabai skhd and spacebar");

  config = mkIf (cfg.enable) {
    services.yabai = {
      enable = cfg.enable;
      package = pkgs.yabai;
      enableScriptingAddition = true;
      config = {
        focus_follows_mouse = "autoraise";
        mouse_follows_focus = "off";
        window_placement = "second_child";
        window_opacity = "off";
        window_opacity_duration = "0.0";
        window_border = "on";
        window_border_placement = "inset";
        window_border_width = 2;
        window_border_radius = 9;
        active_window_border_topmost = "off";
        window_topmost = "on";
        window_shadow = "float";
        active_window_border_color = "0xff5c7e81";
        normal_window_border_color = "0xff505050";
        insert_window_border_color = "0xffd75f5f";
        active_window_opacity = "1.0";
        normal_window_opacity = "1.0";
        split_ratio = "0.50";
        auto_balance = "on";
        mouse_modifier = "fn";
        mouse_action1 = "move";
        mouse_action2 = "resize";
        layout = "bsp";
        top_padding = 36;
        bottom_padding = 10;
        left_padding = 10;
        right_padding = 10;
        window_gap = 10;
      };

      extraConfig = ''
        # rules
        yabai -m rule --add app='System Preferences' manage=off
      '';
    };

    services.skhd.enable = cfg.enable;
    services.skhd.package = pkgs.skhd;
    services.skhd.skhdConfig = ''
      # toggle window properties
      cmd + ctrl - o : yabai -m window --toggle zoom-fullscreen
      cmd + ctrl - f : yabai -m window --toggle float

      # move focused window
      cmd + ctrl - h : yabai -m window --warp west
      cmd + ctrl - j : yabai -m window --warp south
      cmd + ctrl - k : yabai -m window --warp north
      cmd + ctrl - l : yabai -m window --warp east
    
      # resize
      cmd + ctrl + shift - space : yabai -m space --balance
      cmd + ctrl + shift - j : yabai -m window --resize top:0:100 ; \
                               yabai -m window --resize bottom:0:100
      cmd + ctrl + shift - k : yabai -m window --resize bottom:0:-100 ; \
                               yabai -m window --resize top:0:-100
      cmd + ctrl + shift - h : yabai -m window --resize left:-250:0 ; \
                               yabai -m window --resize right:-250:0
      cmd + ctrl + shift - l : yabai -m window --resize right:250:0 ; \
                               yabai -m window --resize left:250:0
    
      # move to display
      cmd + alt + ctrl - right : yabai -m window --display next
      cmd + alt + ctrl - left  : yabai -m window --display prev

      # fix accidental three-column layout, revert to BSP
      # https://github.com/koekeishiya/yabai/issues/658
      cmd + ctrl - p : yabai -m window --toggle split
    '';

    services.spacebar.enable = cfg.enable;
    services.spacebar.package = pkgs.spacebar;
    services.spacebar.config = {
      position = "top";
      display = "main";
      height = 26;
      title = "on";
      spaces = "on";
      clock = "on";
      power = "on";
      padding_left = 20;
      padding_right = 20;
      spacing_left = 25;
      spacing_right = 15;
      text_font = ''"Hack:Regular:12.0"'';
      icon_font = ''"FiraCode Nerd Font Mono:Retina:12.0"'';
      background_color = "0xff2B2D38";
      foreground_color = "0xffa8a8a8";
      power_icon_color = "0xffcd950c";
      battery_icon_color = "0xffd75f5f";
      dnd_icon_color = "0xffa8a8a8";
      clock_icon_color = "0xffa8a8a8";
      power_icon_strip = " ";
      space_icon = "•";
      space_icon_strip = "1 2 3 4 5 6 7 8 9 10";
      spaces_for_all_displays = "on";
      display_separator = "on";
      display_separator_icon = "";
      space_icon_color = "0xff458588";
      space_icon_color_secondary = "0xff78c4d4";
      space_icon_color_tertiary = "0xfffff9b0";
      clock_icon = "";
      dnd_icon = "";
      clock_format = ''"%d/%m/%y %R"'';
      right_shell = "on";
      right_shell_icon = "";
      right_shell_command = "whoami";
    };
  };
}
