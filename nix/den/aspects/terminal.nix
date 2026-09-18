{ den, ... }:
let
  mkGhosttyColors = c: {
    background = c.scheme.base00;
    foreground = c.scheme.base07;
    selection-background = c.scheme.base08;
    selection-foreground = c.scheme.base0F;
    cursor-color = c.scheme.base06;
    cursor-text = c.scheme.base07;
    palette = c.listKV;
  };

  mkTmuxColors = c: {
    pane-border-style = "fg=${c.scheme.base00} bg=${c.scheme.base00}";
    pane-active-border-style = "fg=${c.scheme.base00} bg=${c.scheme.base00}";
  };
in
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
          expr =
            builtins.filter
              (line: builtins.match "(font-family|shell-integration|window-padding-[xy])=.*" line != null)
              (lib.splitString "\n" eR17.home-manager.users.r17.xdg.configFile."ghostty/config.base".source.text);
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
      let
        themeTarget = "~/.universe/ghostty/theme";
        configBaseName = "ghostty/config.base";
        configName = "ghostty/config";
      in
      {
        homeManager =
          {
            lib,
            config,
            pkgs,
            ...
          }:
          let
            shellPkg = pkgs.${user.shell};
            themeFile = builtins.replaceStrings [ "~" ] [ config.home.homeDirectory ] themeTarget;
            configBaseFile = "${config.xdg.configHome}/${configBaseName}";
            configFile = "${config.xdg.configHome}/${configName}";
            ghosttyShellInit = pkgs.writeShellScript "ghostty-shell-init" ''
              if [ -f "${themeFile}" ]; then
                while IFS= read -r line; do
                  case "$line" in
                    background=*) printf '\e]11;%s\a' "''${line#background=}" ;;
                    foreground=*) printf '\e]10;%s\a' "''${line#foreground=}" ;;
                    cursor-color=*) printf '\e]12;%s\a' "''${line#cursor-color=}" ;;
                    palette=*=*)
                      rest="''${line#palette=}"
                      printf '\e]4;%s;%s\a' "''${rest%%=*}" "''${rest#*=}" ;;
                  esac
                done < "${themeFile}"
              fi
              exec ${shellPkg}/bin/${user.shell} -l
            '';
            ghosttyBase =
              (pkgs.formats.keyValue { listsAsDuplicateKeys = true; }).generate "ghostty-config-base"
                {
                  command = ghosttyShellInit;
                  shell-integration = user.shell;
                  desktop-notifications = true;
                  confirm-close-surface = false;
                  custom-shader-animation = true;
                  window-decoration = false;
                  window-padding-x = 8;
                  window-padding-y = 5;
                  window-padding-color = "background";
                  bold-is-bright = true;
                  background-opacity = 1;
                  cursor-style = "underline";
                  cursor-style-blink = true;
                  cursor-click-to-move = false;
                  macos-window-shadow = false;
                  macos-titlebar-style = "transparent";
                  font-feature = "liga,calt,dlig";
                  font-family = user.font;
                  font-thicken = true;
                };
          in
          {
            xdg.configFile.${configBaseName}.source = ghosttyBase;

            home.activation.ghosttyConfig = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
              base="${configBaseFile}"
              theme="${themeFile}"
              out="${configFile}"
              if [ -f "$base" ] || [ -L "$base" ]; then
                cat "$base" > "$out"
                if [ -f "$theme" ]; then
                  cat "$theme" >> "$out"
                fi
              fi
            '';

            programs.fish.interactiveShellInit = ''
              function __universe_ghostty_apply --on-variable __universe_ghostty_theme
                test "$TERM_PROGRAM" = ghostty; or return
                test -f "$__universe_ghostty_theme"; or return
                while read -l line
                  switch $line
                    case 'background=*'
                      printf '\e]11;%s\a' (string replace 'background=' "" $line)
                    case 'foreground=*'
                      printf '\e]10;%s\a' (string replace 'foreground=' "" $line)
                    case 'cursor-color=*'
                      printf '\e]12;%s\a' (string replace 'cursor-color=' "" $line)
                    case 'palette=*=*'
                      set -l parts (string replace 'palette=' "" $line | string split '=')
                      printf '\e]4;%s;%s\a' $parts[1] $parts[2]
                  end
                end < "$__universe_ghostty_theme"
              end
              if test "$TERM_PROGRAM" = ghostty; and set -q __universe_ghostty_theme; and test -f "$__universe_ghostty_theme"
                __universe_ghostty_apply
              end
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
            formatter = pkgs.formats.keyValue { listsAsDuplicateKeys = true; };
            variants = lib.mapAttrs (
              themeName: themeList:
              formatter.generate "ghostty-theme-${themeName}" (mkGhosttyColors (colors.mkColor themeList))
            ) colors.lists;
            applyScript = pkgs.writers.writeNuBin "ghostty-apply" ''
              def main [theme_file: string] {
                ^${pkgs.fish}/bin/fish -c $"set -eU __universe_ghostty_theme; set -U __universe_ghostty_theme ($theme_file)"

                let config_base = $"($env.HOME)/.config/${configBaseName}"
                let config_out = $"($env.HOME)/.config/${configName}"
                if ($config_base | path exists) {
                  let base = open $config_base --raw
                  if ($theme_file | path exists) {
                    $"($base)(open $theme_file --raw)" | save $config_out --raw --force
                  } else {
                    $base | save $config_out --raw --force
                  }
                }

                if not ("/dev/tty" | path exists) { return }
                let esc = "\u{1b}"
                let bel = "\u{07}"
                mut output = ""
                for line in (open $theme_file | lines) {
                  if ($line | str starts-with "background=") {
                    $output = $output + $"($esc)]11;($line | str replace "background=" "")($bel)"
                  } else if ($line | str starts-with "foreground=") {
                    $output = $output + $"($esc)]10;($line | str replace "foreground=" "")($bel)"
                  } else if ($line | str starts-with "cursor-color=") {
                    $output = $output + $"($esc)]12;($line | str replace "cursor-color=" "")($bel)"
                  } else if ($line | str starts-with "palette=") {
                    let rest = $line | str replace "palette=" ""
                    let parts = $rest | split row "="
                    $output = $output + $"($esc)]4;($parts.0);($parts.1)($bel)"
                  }
                }
                if ($output | is-not-empty) {
                  $output | save /dev/tty --raw --force
                }
              }
            '';
          in
          {
            name = "terminal.ghostty";
            mechanism = "prebuilt-swap";
            inherit variants;
            target = themeTarget;
            applicator = "${applyScript}/bin/ghostty-apply {variant}";
          };
      };

    provides.tmux =
      { user, ... }:
      {
        runtime =
          { lib, colors, ... }:
          let
            values = lib.mapAttrs (_themeName: themeList: mkTmuxColors (colors.mkColor themeList)) colors.lists;
          in
          {
            name = "terminal.tmux";
            mechanism = "command-dispatch";
            inherit values;
            commands = {
              pane-border-style = "tmux set -g pane-border-style '{value}'";
              pane-active-border-style = "tmux set -g pane-active-border-style '{value}'";
            };
          };

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
