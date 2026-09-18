{ den, ... }:
{
  den.aspects.terminal = {
    includes = with den.aspects.terminal.provides; [
      ghostty
      tmux
    ];
    tests =
      { eR17, lib, ... }:
      {
        test-ghostty-renders-profile-font-and-padding = {
          expr = builtins.filter (
            line: builtins.match "(font-family|shell-integration|window-padding-[xy])=.*" line != null
          ) (lib.splitString "\n" eR17.home-manager.users.r17.xdg.configFile."ghostty/config".source.text);
          expected = [
            "font-family=Kode Mono"
            "shell-integration=fish"
            "window-padding-x=8"
            "window-padding-y=5"
          ];
        };
        test-tmux-configures-keyboard-navigation = {
          expr = {
            inherit (eR17.home-manager.users.r17.programs.tmux)
              enable
              prefix
              keyMode
              resizeAmount
              ;
          };
          expected = {
            enable = true;
            prefix = "C-Space";
            keyMode = "vi";
            resizeAmount = 10;
          };
        };
      };

    provides.ghostty =
      { user, ... }:
      {
        homeManager =
          { color, pkgs, ... }:
          {
            xdg.configFile."ghostty/config".source =
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
                font-feature = "liga,calt,dlig";
                font-family = user.font;
                font-thicken = true;
              };
          };
      };

    provides.tmux =
      { user, ... }:
      {
        homeManager =
          {
            lib,
            color,
            config,
            pkgs,
            ...
          }:
          let
            tmuxWorkspaces = lib.mapAttrs (_: ws: {
              session_name = ws.sessionName;
              windows = [
                {
                  window_name = ws.sessionName;
                  layout = "tiled";
                  shell_command_before = [ "cd ${ws.path}" ];
                  panes = [
                    "nvim"
                    "echo happy working"
                  ];
                }
              ];
            }) user.workspaces;
          in
          {
            home.shellAliases = lib.mapAttrs' (
              name: _:
              lib.nameValuePair "tm${builtins.substring 0 1 name}" "tmuxp load ${
                builtins.toFile "tmuxp-${name}.json" (builtins.toJSON tmuxWorkspaces.${name})
              }"
            ) user.workspaces;

            programs.tmux.enable = true;
            programs.tmux.mouse = false;
            programs.tmux.newSession = true;
            programs.tmux.reverseSplit = true;
            programs.tmux.customPaneNavigationAndResize = true;
            programs.tmux.prefix = "C-Space";
            programs.tmux.resizeAmount = 10;
            programs.tmux.terminal = "screen-256color";
            programs.tmux.keyMode = "vi";
            programs.tmux.extraConfig = # tmux
              ''
                set -g status off

                bg_color='${color.scheme.base00}'

                set -g pane-border-style "fg=$bg_color bg=$bg_color"
                set -g pane-active-border-style "fg=$bg_color bg=$bg_color"
                set -sg escape-time 10

                set -g @continuum-boot on

                bind " " choose-tree -Zw
                bind a new-session
                bind A kill-session
                bind w new-window
                bind W kill-window
                bind x kill-pane

                bind n previous-window
                bind N next-window

                bind \, command-prompt "rename-window %%"
                bind \< command-prompt "rename-session %%"

                bind \? list-keys

                bind v split-pane -h
                bind V split-pane -v

                set -gu default-command
                set -g default-shell "$SHELL"

                set -gq allow-passthrough on
                set -g visual-activity off
              '';
            programs.tmux.tmuxp.enable = config.programs.tmux.enable;

            programs.tmux.plugins = with pkgs.tmuxPlugins; [
              {
                plugin = yank;
                extraConfig = # tmux
                  ''
                    bind Enter copy-mode

                    set -g @shell_mode 'vi'
                    set -g @yank_selection_mouse 'clipboard'

                    run -b 'tmux bind -t vi-copy v begin-selection 2> /dev/null || true'
                    run -b 'tmux bind -T copy-mode-vi v send -X begin-selection 2> /dev/null || true'
                    run -b 'tmux bind -t vi-copy C-v rectangle-toggle 2> /dev/null || true'
                    run -b 'tmux bind -T copy-mode-vi C-v send -X rectangle-toggle 2> /dev/null || true'
                    run -b 'tmux bind -t vi-copy y copy-selection 2> /dev/null || true'
                    run -b 'tmux bind -T copy-mode-vi y send -X copy-selection-and-cancel 2> /dev/null || true'
                    run -b 'tmux bind -t vi-copy Escape cancel 2> /dev/null || true'
                    run -b 'tmux bind -T copy-mode-vi Escape send -X cancel 2> /dev/null || true'
                    run -b 'tmux bind -t vi-copy H start-of-line 2> /dev/null || true'
                    run -b 'tmux bind -T copy-mode-vi H send -X start-of-line 2> /dev/null || true'
                    run -b 'tmux bind -t vi-copy L end-of-line 2> /dev/null || true'
                    run -b 'tmux bind -T copy-mode-vi L send -X end-of-line 2> /dev/null || true'
                  '';
              }

              { plugin = resurrect; }
              {
                plugin = continuum;
                extraConfig = # tmux
                  ''
                    set -g @resurrect-strategy-nvim 'session'
                    set -g @resurrect-capture-pane-contents 'on'
                    set -g @continuum-restore 'on'
                    set -g @continuum-save-interval '60'
                  '';
              }
            ];
          };
      };
  };
}
