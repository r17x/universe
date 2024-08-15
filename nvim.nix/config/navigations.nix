# this declarations based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/keymap.lua}
{ helpers, pkgs, ... }:

let
  inherit (helpers) mkRaw;

  resize.up = mkRaw "function() vim.cmd [[ resize +1 ]] end";
  resize.down = mkRaw "function() vim.cmd [[ resize -1 ]] end";
  resize.left = mkRaw "function() vim.cmd [[ vertical resize -1 ]] end";
  resize.right = mkRaw "function() vim.cmd [[ vertical resize +1 ]] end";
in
{
  extraPackages = [ pkgs.gh ];
  extraPlugins = [ pkgs.vimPlugins.telescope-github-nvim ];
  plugins.telescope.enabledExtensions = [ "gh" ];

  clipboard.register = "unnamed";

  plugins.telescope.enable = true;
  plugins.telescope.keymaps.ff.options.desc = "Find by files";
  plugins.telescope.keymaps.ff.action = "find_files";
  plugins.telescope.keymaps.fb.options.desc = "Find by current buffers";
  plugins.telescope.keymaps.fb.action = "buffers";
  plugins.telescope.keymaps.fbb.options.desc = "Find Fuzz by current buffers";
  plugins.telescope.keymaps.fbb.action = "current_buffer_fuzzy_find";
  plugins.telescope.keymaps.fh.options.desc = "Find by help tags";
  plugins.telescope.keymaps.fh.action = "help_tags";
  plugins.telescope.keymaps.fg.options.desc = "Find by words";
  plugins.telescope.keymaps.fg.action = "live_grep";
  plugins.telescope.keymaps.fch.options.desc = "Find by Colors Highlights";
  plugins.telescope.keymaps.fch.action = "highlights";

  plugins.telescope.keymaps.fghi.options.desc = "Find by Github Issues";
  plugins.telescope.keymaps.fghi.action = "gh issues";
  plugins.telescope.keymaps.fgho.options.desc = "Find by Github Pull Requests";
  plugins.telescope.keymaps.fgho.action = "gh pull_requests";
  plugins.telescope.keymaps.fghr.options.desc = "Find by Github Actions (run)";
  plugins.telescope.keymaps.fghr.action = "gh run";
  plugins.telescope.keymaps.fghs.options.desc = "Find by Github Gist";
  plugins.telescope.keymaps.fghs.action = "gh gist";

  plugins.which-key.enable = true;
  plugins.which-key.triggers = [
    "<leader>"
    "f"
  ];
  plugins.which-key.registrations = {
    "<leader>w" = [
      "<cmd>w<cr>"
      "Write current buffer"
    ];
    "<leader>ww" = [
      "<cmd>w!<cr>"
      "Write current buffer forced"
    ];
    "<leader>wq" = [
      "<cmd>wq<cr>"
      "Write current buffer and quit"
    ];
    "<leader>wqq" = [
      "<cmd>wq<cr>"
      "Write & quit forced"
    ];

    "Y" = [
      "\"+yy"
      "Copy to Clipboard!"
    ];
    "p" = [
      "\"+p"
      "Paste from Clipboard"
    ];

    "<c-h>" = [
      "<c-w>h"
      "Move top"
    ];
    "<c-j>" = [
      "<c-w>j"
      "Move down"
    ];
    "<c-k>" = [
      "<c-w>k"
      "Move left"
    ];
    "<c-l>" = [
      "<c-w>l"
      "Move right"
    ];
    "fw" = [
      "<cmd>HopWord<cr>"
      "Find by Word"
    ];
    "fhh" = [
      "<cmd>HopPattern<cr>"
      "Find by Patterns"
    ];

    "<up>" = [
      resize.up
      "resize window up"
    ];
    "<down>" = [
      resize.down
      "resize window down"
    ];
    "<left>" = [
      resize.left
      "resize window right"
    ];
    "<right>" = [
      resize.right
      "resize window left"
    ];
  };

  plugins.hop.enable = true;
}
