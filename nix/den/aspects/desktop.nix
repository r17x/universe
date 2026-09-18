{ den, ... }:
let
  mkSketchybarLua =
    pkgs: sbarConfig:
    pkgs.lua54Packages.lua.withPackages (ps: [
      ps.lua
      pkgs.sbarlua
      sbarConfig
    ]);
in
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
        { pkgs, lib, ... }:
        let
          sketchybarWrapper = pkgs.writeShellScript "sketchybar-start" ''
            exec ${lib.getExe pkgs.sketchybar} --config "$HOME/.universe/sketchybar/sketchybarrc"
          '';
        in
        {
          services.sketchybar = {
            enable = true;
            extraPackages = with pkgs; [
              sbar_menus
              sbar_events
            ];
            config = "";
          };

          launchd.user.agents.sketchybar.serviceConfig = {
            ProgramArguments = lib.mkForce [ "${sketchybarWrapper}" ];
            ProcessType = "Background";
            Nice = 5;
            LowPriorityIO = true;
            ThrottleInterval = 10;
          };

          environment.systemPackages = with pkgs; [
            sbar_menus
            sbar_events
          ];
        };

      homeManager =
        { pkgs, lib, ... }:
        let
          lua = mkSketchybarLua pkgs pkgs.sketchybarConfigLua;
          defaultConfig = pkgs.writeScript "sketchybarrc" ''
            #!${lua}/bin/lua
            require("init")
          '';
        in
        {
          home.activation.sketchybarConfig = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
            mkdir -p "$HOME/.universe/sketchybar"
            if [ ! -e "$HOME/.universe/sketchybar/sketchybarrc" ]; then
              ln -sf ${defaultConfig} "$HOME/.universe/sketchybar/sketchybarrc"
            fi
          '';
        };

      runtime =
        {
          pkgs,
          lib,
          colors,
          ...
        }:
        let
          mkVariant =
            profileName: profile: themeName: palette:
            let
              themeColors = pkgs.sketchybarConfigLua.mkColors palette;
              pkg = pkgs.sketchybarConfigLua.override {
                sketchybarColors = themeColors;
                sketchybarStyle = profile;
              };
              lua = mkSketchybarLua pkgs pkg;
            in
            pkgs.writeScript "sketchybarrc-${profileName}-${themeName}" ''
              #!${lua}/bin/lua
              require("init")
            '';

          profileNames = builtins.attrNames pkgs.sketchybarConfigLua.profiles;

          variants = lib.listToAttrs (
            lib.concatMap (
              profileName:
              lib.mapAttrsToList (
                themeName: palette:
                lib.nameValuePair "${profileName}.${themeName}" (
                  mkVariant profileName pkgs.sketchybarConfigLua.profiles.${profileName} themeName palette
                )
              ) colors.semanticPalettes
            ) profileNames
          );
        in
        {
          name = "desktop.sketchybar";
          mechanism = "prebuilt-swap";
          inherit variants;
          profiles = profileNames;
          default_profile = "default";
          target = "~/.universe/sketchybar/sketchybarrc";
          applicator = "sketchybar --reload";
        };
    };

    provides.jankyborders = {
      darwin =
        {
          color,
          colors,
          pkgs,
          ...
        }:
        let
          withAlpha = colors.toArgb;
          sbarPalette = pkgs.sketchybarConfigLua.defaultPalette;
        in
        {
          services.jankyborders = {
            enable = true;
            width = 6.5;
            hidpi = false;
            active_color = colors.toArgb 1.0 color.scheme.base07;
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

      runtime =
        { lib, colors, ... }:
        let
          withAlpha = colors.toArgb;
          values = lib.mapAttrs (themeName: palette: {
            active_color = colors.toArgb 1.0 (colors.mkColor (colors.lists.${themeName})).scheme.base07;
            inactive_color = withAlpha (192.0 / 255) palette.barBg;
            background_color = withAlpha (48.0 / 255) palette.barBg;
          }) colors.semanticPalettes;
        in
        {
          name = "desktop.jankyborders";
          mechanism = "command-dispatch";
          inherit values;
          commands = {
            active_color = "borders active_color={value}";
            inactive_color = "borders inactive_color={value}";
            background_color = "borders background_color={value}";
          };
        };
    };
  };
}
