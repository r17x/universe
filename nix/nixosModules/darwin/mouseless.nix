{
  lib,
  config,
  pkgs,
  ...
}:

let
  cfg = config.mouseless;

  inherit (lib) mdDoc mkEnableOption mkIf;

  lua = pkgs.lua54Packages.lua.withPackages (ps: [
    ps.lua
    pkgs.sbarLua
    pkgs.sketchybarConfigLua
  ]);

in
{
  options.mouseless.enable = mkEnableOption (mdDoc "Enable Mouseless with yabai skhd and sketchybar");

  config = mkIf (cfg.enable) {
    services.sketchybar = {
      inherit (cfg) enable;
      extraPackages = with pkgs; [
        sbar_menus
        sbar_events
      ];

      config = # lua
        ''
          #!${lua}/bin/lua
          package.cpath = package.cpath .. ";${lua}/lib/?.so"
          require("init")
        '';
    };

    services.yabai = {
      inherit (cfg) enable;
      package = pkgs.yabai;
      enableScriptingAddition = false; # true when SIP Disabled
      config = {
        external_bar = "all:40:0";
        mouse_follows_focus = "off";
        focus_follows_mouse = "off";
        window_zoom_persist = "off";
        window_placement = "second_child";
        window_shadow = "float";
        window_opacity = "on";
        window_opacity_duration = "0.2";
        active_window_opacity = "1.0";
        normal_window_opacity = "0.8";
        window_animation_duration = "0.5";
        window_animation_easing = "ease_out_quint";
        insert_feedback_color = "0xff9dd274";
        split_ratio = "0.50";
        auto_balance = "off";
        mouse_modifier = "fn";
        mouse_action1 = "move";
        mouse_action2 = "resize";
        mouse_drop_action = "swap";

        top_padding = 8;
        bottom_padding = 8;
        left_padding = 8;
        right_padding = 8;
        window_gap = 10;
      };

      extraConfig = # bash
        ''
          yabai -m rule --add app="^(LuLu|Calculator|Software Update|Dictionary|VLC|System Preferences|System Settings|zoom.us|Photo Booth|Archive Utility|Python|LibreOffice|App Store|Steam|Alfred|Activity Monitor)$" manage=off
          yabai -m rule --add label="Finder" app="^Finder$" title="(Co(py|nnect)|Move|Info|Pref)" manage=off
          yabai -m rule --add label="Safari" app="^Safari$" title="^(General|(Tab|Password|Website|Extension)s|AutoFill|Se(arch|curity)|Privacy|Advance)$" manage=off
          yabai -m rule --add label="About This Mac" app="System Information" title="About This Mac" manage=off
          yabai -m rule --add label="Select file to save to" app="^Inkscape$" title="Select file to save to" manage=off

          yabai -m config layout bsp
        '';
    };

    services.jankyborders = {
      enable = cfg.enable;
      width = 6.5;
      hidpi = false;
      active_color = "0xfffeeff0";
      inactive_color = "0xc02c2e34";
      background_color = "0x302c2e34";
      style = "round";
    };

    environment.systemPackages = with pkgs; [
      jq
      skhd
      yabai
      # todo mo to overlays
      sbar_menus
      sbar_events
    ];

    services.skhd = {
      enable = cfg.enable;
      package = pkgs.skhd;
      skhdConfig =
        let
          leader = "lalt";
          moveByIndex =
            index: # bash
            ''eval "$(yabai -m query --spaces | jq --argjson index "${index}" -r '(.[] | select(.index == ${index}).windows[0]) as $wid | if $wid then "yabai -m window --focus \"" + ($wid | tostring) + "\"" else "skhd --key \"ctrl - " + (map(select(."is-native-fullscreen" == false)) | index(map(select(.index == ${index}))) + 1 % 10 | tostring) + "\"" end')"'';
        in
        # fish
        ''
          # Toggle

          ## float and center focus
          ${leader} - space : yabai -m window --toggle float; yabai -m window --grid 4:4:1:1:2:2

          ## float and center increase size
          ctrl + ${leader} - a : yabai -m window --resize bottom:0:100 || yabai -m window --resize top:0:100; \
            yabai -m window --resize right:100:0 || yabai -m window --resize left:100:0; \
            yabai -m window --grid 4:4:1:1:2:2

          ## sketchybar toggle
          shift + ${leader} - space : sketchybar --bar hidden=toggle

          ## padding & gap toggle
          ctrl + ${leader} - g : yabai -m space --toggle padding; yabai -m space --toggle gap

          ## resize
          ctrl + ${leader} - h : yabai -m window --resize right:-100:0 || yabai -m window --resize left:-100:0
          ctrl + ${leader} - j : yabai -m window --resize bottom:0:100 || yabai -m window --resize top:0:100
          ctrl + ${leader} - k : yabai -m window --resize bottom:0:-100 || yabai -m window --resize top:0:-100
          ctrl + ${leader} - l : yabai -m window --resize right:100:0 || yabai -m window --resize left:100:0

          ## zoom parent
          ${leader} - f : yabai -m window --toggle zoom-parent

          ## zoom fullscreen
          shift + ${leader} - f : yabai -m window --toggle zoom-fullscreen

          # Movement

          ## Equalize size of windows: ctrl + lalt - e
          ${leader} - b : yabai -m space --balance

          ## New window in hor./ vert. splits for all applications with yabai
          ${leader} - s : yabai -m window --insert east;  skhd -k "cmd - n"
          ${leader} - v : yabai -m window --insert south; skhd -k "cmd - n"

          ctrl + ${leader} - n : yabai -m space --create && \
                   index="$(yabai -m query --spaces --display | jq 'map(select(."native-fullscreen" == 0))[-1].index')" && \
                   yabai -m window --space "$\{index}" && \
                   yabai -m space --focus "$\{index}"

          ## Mirror Space on X and Y Axis: shift + lalt - {x, y}
          shift + ${leader} - x : yabai -m space --mirror x-axis
          shift + ${leader} - y : yabai -m space --mirror y-axis

          ## focus window
          ${leader} - h : yabai -m window --focus west
          ${leader} - j : yabai -m window --focus south
          ${leader} - k : yabai -m window --focus north
          ${leader} - l : yabai -m window --focus east

          ## move managed window
          ctrl + ${leader} - h : yabai -m window --warp west
          ctrl + ${leader} - j : yabai -m window --warp south
          ctrl + ${leader} - k : yabai -m window --warp north
          ctrl + ${leader} - l : yabai -m window --warp east

          ## move desktop
          ${leader} - 1 : ${moveByIndex "1"}
          ${leader} - 2 : ${moveByIndex "2"}
          ${leader} - 3 : ${moveByIndex "3"}
          ${leader} - 4 : ${moveByIndex "4"}
          ${leader} - 5 : ${moveByIndex "5"}
          ${leader} - 6 : ${moveByIndex "6"}
          ${leader} - 7 : ${moveByIndex "7"}
          ${leader} - 8 : ${moveByIndex "8"}
          ${leader} - 9 : ${moveByIndex "9"}

          ## move window and focus desktop
          shift + ${leader} - 1 : yabai -m window --space 1; yabai -m space --focus 1
          shift + ${leader} - 2 : yabai -m window --space 2; yabai -m space --focus 2
          shift + ${leader} - 3 : yabai -m window --space 3; yabai -m space --focus 3
          shift + ${leader} - 4 : yabai -m window --space 4; yabai -m space --focus 4
          shift + ${leader} - 5 : yabai -m window --space 5; yabai -m space --focus 5
          shift + ${leader} - 6 : yabai -m window --space 6; yabai -m space --focus 6
          shift + ${leader} - 7 : yabai -m window --space 7; yabai -m space --focus 7
          shift + ${leader} - 8 : yabai -m window --space 8; yabai -m space --focus 8
          shift + ${leader} - 9 : yabai -m window --space 9; yabai -m space --focus 9

          ## rotate tree
          ${leader} - r : yabai -m space --rotate 90
        '';
    };
  };
}
