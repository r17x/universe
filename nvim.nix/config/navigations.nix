# this declarations based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/keymap.lua}
{ helpers, ... }:

let
  inherit (helpers) mkRaw;

  tb.findFiles = mkRaw "require'telescope.builtin'.find_files";
  tb.liveGrep = mkRaw "require'telescope.builtin'.live_grep";
  tb.findBuffers = mkRaw "require'telescope.builtin'.buffers";
  tb.findHelpTags = mkRaw "require'telescope.builtin'.help_tags";

  resize.up = mkRaw "function() vim.cmd [[ resize +1 ]] end";
  resize.down = mkRaw "function() vim.cmd [[ resize -1 ]] end";
  resize.left = mkRaw "function() vim.cmd [[ vertical resize -1 ]] end";
  resize.right = mkRaw "function() vim.cmd [[ vertical resize +1 ]] end";

in

{
  clipboard.register = "unnamed";
  plugins.telescope.enable = true;

  plugins.which-key.enable = true;
  plugins.which-key.triggers = [
    "<leader>"
    "g"
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

    "ff" = [
      tb.findFiles
      "Find by files"
    ];
    "fb" = [
      tb.findBuffers
      "Find by current buffers"
    ];
    "fh" = [
      tb.findHelpTags
      "Find by help tags"
    ];
    "fg" = [
      tb.liveGrep
      "Find by words"
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
