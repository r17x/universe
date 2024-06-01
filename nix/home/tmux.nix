{ pkgs, lib, ... }:


{
  programs.tmux.enable = true;
  programs.tmux.mouse = false;
  programs.tmux.newSession = true;
  programs.tmux.reverseSplit = true;
  programs.tmux.customPaneNavigationAndResize = true;
  programs.tmux.prefix = "C-Space";
  programs.tmux.resizeAmount = 10;
  programs.tmux.terminal = "screen-256color";
  programs.tmux.keyMode = "vi";
  programs.tmux.baseIndex = 1;
  programs.tmux.extraConfig = ''

    set -g status off

    # COLORS
    bg_color='#282c34'

    # BORDERS COLOR
    set -g pane-border-style "fg=$bg_color bg=$bg_color"
    set -g pane-active-border-style "fg=$bg_color bg=$bg_color"
    set -sg escape-time 10 

    set -g visual-activity off
    set -gq allow-passthrough on
   '';

  # Plugin disable cause in version 3.3a tmux server crashed
  programs.tmux.plugins = with pkgs.tmuxPlugins;
    [
      {
        plugin = tmux-thumbs;
        extraConfig = ''
          set -g @thumbs-command 'echo -n {} | copy'
        '';
      }
      {
        plugin = yank;
        extraConfig = ''
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
      {
        plugin = resurrect;
        extraConfig = "set -g @resurrect-strategy-nvim 'session'";
      }
      {
        plugin = continuum;
        extraConfig = ''
          set -g @continuum-restore 'on'
          set -g @continuum-save-interval '60' # minutes
        '';
      }
    ];

  home.packages = lib.optionals pkgs.stdenv.isDarwin [
    pkgs.reattach-to-user-namespace
  ];

}
