{ pkgs, ... }:

{
  extraPlugins = [ pkgs.vimPlugins.nvim-sops ];

  # $OPENAI_API_KEY must be set in your environment.
  extraConfigLuaPost = "require('nvim_sops').setup()";
}
