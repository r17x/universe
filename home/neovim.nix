{ config, pkgs, lib, ... }:
let
  inherit (config.lib.file) mkOutOfStoreSymlink;
  inherit (config.home.user-info) nixConfigDirectory;
in
{
  programs.neovim.enable = true;

  programs.neovim.extraConfig = ''
    " -- apply all settings (option, global option, autocmds, & mappings)
    lua require 'utils'.apply_settings(require 'settings')
    " -- apply all plugins
    lua require 'plugins'
    set packpath^=~/.local/share/nvim/pack
    set runtimepath^=~/.local/share/nvim
  '';

  xdg.configFile."nvim/lua".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/lua";
  xdg.configFile."nvim/stylua.toml".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/stylua.toml";

  programs.neovim.extraPackages = with pkgs; [
    rustPackages.rustc
    rustPackages.rustfmt
    rustPackages.cargo
    ctags
    tree-sitter
    rnix-lsp
  ];
}
