# this declarations based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/keymap.lua}
{
  icons,
  helpers,
  pkgs,
  ...
}:

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
  plugins.which-key.settings.triggers = [
    {
      __unkeyed-1 = "<leader>";
      mode = "n";
    }
    {
      __unkeyed-1 = "g";
      mode = "n";
    }
    {
      __unkeyed-1 = "f";
      mode = "n";
    }
  ];
  plugins.which-key.settings.spec = [
    {
      __unkeyed-1 = "<leader>w";
      __unkeyed-2 = "<cmd>w<cr>";
      desc = icons.withIcon "git" "Write current buffer";
    }

    {
      __unkeyed-1 = "<leader>ww";
      __unkeyed-2 = "<cmd>w!<cr>";
      desc = icons.withIcon "git" "Write current buffer forced";
    }

    {
      __unkeyed-1 = "<leader>wq";
      __unkeyed-2 = "<cmd>wq<cr>";
      desc = icons.withIcon "git" "Write current buffer and quit";
    }

    {
      __unkeyed-1 = "<leader>wqq";
      __unkeyed-2 = "<cmd>wq<cr>";
      desc = icons.withIcon "git" "Write & quit forced";
    }

    {
      __unkeyed-1 = "Y";
      __unkeyed-2 = "\"+yy";
      desc = icons.withIcon "git" "Copy to Clipboard!";
    }

    {
      __unkeyed-1 = "p";
      __unkeyed-2 = "\"+p";
      desc = icons.withIcon "git" "Paste from Clipboard";
    }

    {
      __unkeyed-1 = "<c-h>";
      __unkeyed-2 = "<c-w>h";
      desc = icons.withIcon "git" "Move top";
    }

    {
      __unkeyed-1 = "<c-j>";
      __unkeyed-2 = "<c-w>j";
      desc = icons.withIcon "git" "Move down";
    }

    {
      __unkeyed-1 = "<c-k>";
      __unkeyed-2 = "<c-w>k";
      desc = icons.withIcon "git" "Move left";
    }

    {
      __unkeyed-1 = "<c-l>";
      __unkeyed-2 = "<c-w>l";
      desc = icons.withIcon "git" "Move right";
    }

    {
      __unkeyed-1 = "ff";
      __unkeyed-2 = tb.findFiles;
      desc = icons.withIcon "git" "Find by files";
    }

    {
      __unkeyed-1 = "fb";
      __unkeyed-2 = tb.findBuffers;
      desc = icons.withIcon "git" "Find by current buffers";
    }

    {
      __unkeyed-1 = "fh";
      __unkeyed-2 = tb.findHelpTags;
      desc = icons.withIcon "git" "Find by help tags";
    }

    {
      __unkeyed-1 = "fg";
      __unkeyed-2 = tb.liveGrep;
      desc = icons.withIcon "git" "Find by words";
    }

    {
      __unkeyed-1 = "fw";
      __unkeyed-2 = "<cmd>HopWord<cr>";
      desc = icons.withIcon "git" "Find by Word";
    }

    {
      __unkeyed-1 = "fhh";
      __unkeyed-2 = "<cmd>HopPattern<cr>";
      desc = icons.withIcon "git" "Find by Patterns";
    }

    {
      __unkeyed-1 = "<up>";
      __unkeyed-2 = resize.up;
      desc = icons.withIcon "git" "resize window up";
    }

    {
      __unkeyed-1 = "<down>";
      __unkeyed-2 = resize.down;
      desc = icons.withIcon "git" "resize window down";
    }

    {
      __unkeyed-1 = "<left>";
      __unkeyed-2 = resize.left;
      desc = icons.withIcon "git" "resize window right";
    }

    {
      __unkeyed-1 = "<right>";
      __unkeyed-2 = resize.right;
      desc = icons.withIcon "git" "resize window left";
    }

  ];

  plugins.hop.enable = true;
}
