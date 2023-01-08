{ lib, config, ... }:

with lib;

let
  inherit (config.lib.file) mkOutOfStoreSymlink;
  inherit (config.home.user-info) nixConfigDirectory within;

  cfg = within.neovim;

in
{
  options.within.vim.enable = mkEnableOption "Enables Within's vim config";

  config = mkIf cfg.enable {
    programs.neovim =
      {
        enable = cfg.enable;

        vimdiffAlias = true;

        withNodeJs = true;
        withPython3 = true;

        extraConfig = ''
          " -- apply all settings (option, global option, autocmds, & mappings)
          lua require 'utils'.apply_settings(require 'settings')
          " -- apply all plugins
          lua require 'plugins'
          " -- impure configurations
          " set packpath^=~/.local/share/nvim/pack
          " set runtimepath^=~/.local/share/nvim
          set mouse=
        '';

        # extraPackages = with pkgs; [
        #   rustPackages.rustc
        #   rustPackages.rustfmt
        #   rustPackages.cargo
        #   ctags
        #   tree-sitter
        #   rnix-lsp
        #   gcc
        # ];
      };

    # impure configurations
    xdg.configFile."nvim/lua".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/lua";
    xdg.configFile."nvim/stylua.toml".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/stylua.toml";
  };
}
