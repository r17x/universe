{ den, ... }:
{
  den.aspects.desktop = {
    includes = with den.aspects.desktop.provides; [
      aerospace
      sketchybar
      jankyborders
    ];

    darwin =
      { pkgs, ... }:
      {
        system.defaults.dock.autohide = true;
        system.defaults.dock.mru-spaces = false;
        system.defaults.dock.showhidden = true;
        system.defaults.NSGlobalDomain.AppleKeyboardUIMode = 3;
        services.karabiner-elements.enable = false;
        system.defaults.finder.AppleShowAllExtensions = true;
        system.defaults.finder.QuitMenuItem = true;
        system.defaults.finder.FXEnableExtensionChangeWarning = false;
        system.defaults.trackpad.Clicking = true;
        system.defaults.trackpad.TrackpadThreeFingerDrag = false;
        system.keyboard.enableKeyMapping = true;
        system.keyboard.remapCapsLockToEscape = true;

        environment.systemPackages = with pkgs; [ jq ];
      };

    tests = {
      test-has-aerospace = {
        expr = den.aspects.desktop.provides ? aerospace;
        expected = true;
      };
      test-has-sketchybar = {
        expr = den.aspects.desktop.provides ? sketchybar;
        expected = true;
      };
      test-has-jankyborders = {
        expr = den.aspects.desktop.provides ? jankyborders;
        expected = true;
      };
    };

    provides.aerospace = {
      darwin =
        { lib, pkgs, ... }:
        {
          services.aerospace = {
            enable = true;
            settings = {
              exec-on-workspace-change = [
                "${lib.getExe pkgs.bash}"
                "-c"
                "${lib.getExe pkgs.sketchybar} --trigger aerospace_workspace_change FOCUSED_WORKSPACE=$AEROSPACE_FOCUSED_WORKSPACE"
              ];
              gaps = {
                outer.top = 50;
                outer.bottom = 15;
                outer.left = 15;
                outer.right = 15;
                inner.horizontal = 15;
                inner.vertical = 15;
              };
              mode.main.binding = {
                alt-space = "layout floating";
                alt-z = "resize smart +10";
                alt-shift-z = "resize smart -10";
                alt-v = "layout v_tiles";
                alt-shift-v = "layout h_tiles";
                alt-h = "focus left";
                alt-j = "focus down";
                alt-k = "focus up";
                alt-l = "focus right";
                alt-f = "fullscreen";
                alt-shift-space = "balance-sizes";
                alt-1 = "workspace 1";
                alt-2 = "workspace 2";
                alt-3 = "workspace 3";
                alt-4 = "workspace 4";
                alt-5 = "workspace 5";
                alt-6 = "workspace 6";
                alt-7 = "workspace 7";
                alt-8 = "workspace 8";
                alt-9 = "workspace 9";
                alt-shift-1 = "move-node-to-workspace 1";
                alt-shift-2 = "move-node-to-workspace 2";
                alt-shift-3 = "move-node-to-workspace 3";
                alt-shift-4 = "move-node-to-workspace 4";
                alt-shift-5 = "move-node-to-workspace 5";
                alt-shift-6 = "move-node-to-workspace 6";
                alt-shift-7 = "move-node-to-workspace 7";
                alt-shift-8 = "move-node-to-workspace 8";
                alt-shift-9 = "move-node-to-workspace 9";
              };
            };
          };
        };
    };

    provides.sketchybar = {
      darwin =
        { pkgs, ... }:
        let
          lua = pkgs.lua54Packages.lua.withPackages (ps: [
            ps.lua
            pkgs.sbarlua
            pkgs.sketchybarConfigLua
          ]);
        in
        {
          services.sketchybar = {
            enable = true;
            extraPackages = with pkgs; [
              sbar_menus
              sbar_events
            ];
            config = # lua
              ''
                #!${lua}/bin/lua
                require("init")
              '';
          };

          environment.systemPackages = with pkgs; [
            sbar_menus
            sbar_events
          ];

          launchd.user.agents.sketchybar.serviceConfig = {
            ProcessType = "Background";
            Nice = 5;
            LowPriorityIO = true;
            ThrottleInterval = 10;
          };
        };
    };

    provides.jankyborders = {
      darwin =
        { colors, pkgs, ... }:
        let
          withAlpha = colors.toArgb;
          sbarPalette = pkgs.sketchybarConfigLua.defaultPalette;
        in
        {
          services.jankyborders = {
            enable = true;
            width = 6.5;
            hidpi = false;
            active_color = "0xfffeeff0";
            inactive_color = withAlpha (192.0 / 255) sbarPalette.barBg;
            background_color = withAlpha (48.0 / 255) sbarPalette.barBg;
            style = "round";
          };

          launchd.user.agents.jankyborders.serviceConfig = {
            ProcessType = "Background";
            Nice = 5;
            LowPriorityIO = true;
            ThrottleInterval = 10;
          };
        };
    };
  };
}
