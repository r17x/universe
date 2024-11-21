{
  config,
  pkgs,
  lib,
  ...
}:

let
  tmuxWorkspaces = {
    me = {
      session_name = "Me";
      windows = [
        {
          window_name = "Me";
          layout = "tiled";
          shell_command_before = [ "cd ~/evl" ];
          panes = [
            "nvim"
            "echo happy working"
          ];
        }
      ];
    };

    work = {
      session_name = "Work";
      windows = [
        {
          window_name = "Work";
          layout = "tiled";
          shell_command_before = [ "cd ~/w1" ];
          panes = [
            "nvim"
            "echo happy working"
          ];
        }
      ];
    };
  };
in

{
  home.shellAliases = {
    tmw = "tmuxp load ${builtins.toFile "tmuxp-work.json" (builtins.toJSON tmuxWorkspaces.work)}";
    tme = "tmuxp load ${builtins.toFile "tmuxp-me.json" (builtins.toJSON tmuxWorkspaces.me)}";
  };

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

      # COLORS
      bg_color='#282c34'

      # BORDERS COLOR
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

      # TEMPORARY WORKAROUND FOR TMUX SENSIBLE ISSUE
      set -gu default-command
      set -g default-shell "$SHELL"
      # end

      # Workaround for image
      set -gq allow-passthrough on
      set -g visual-activity off
      #
    '';
  programs.tmux.tmuxp.enable = config.programs.tmux.enable;

  programs.tmux.plugins = with pkgs.tmuxPlugins; [
    {
      plugin = yank;
      extraConfig = # tmux
        ''
          bind Enter copy-mode # enter copy mode

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
          set -g @continuum-save-interval '60' # minutes
        '';
    }
  ];

  home.packages = lib.optionals pkgs.stdenv.isDarwin [ pkgs.reattach-to-user-namespace ];
}
