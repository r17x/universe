{ pkgs, icons, ... }:

let

  gs.toggle_signs = "require'gitsigns'.toggle_signs";
  gs.toggle_numhl = "require'gitsigns'.toggle_numhl";
  gs.toggle_linehl = "require'gitsigns'.toggle_linehl";
  gs.toggle_word_diff = "require'gitsigns'.toggle_word_diff";
  gs.toggle_deleted = "require'gitsigns'.toggle_deleted";
  gs.toggle_current_line_blame = "require'gitsigns'.toggle_current_line_blame";

in

{
  extraPackages = [ pkgs.gh ];
  extraPlugins = [ pkgs.vimPlugins.telescope-github-nvim ];

  plugins.telescope.enabledExtensions = [ "gh" ];
  plugins.telescope.keymaps.fgc.options.desc = "Lists git commits.";
  plugins.telescope.keymaps.fgc.action = "git_commits";
  plugins.telescope.keymaps.fgf.options.desc = "Lists buffer's git commits.";
  plugins.telescope.keymaps.fgf.action = "git_bcommits";
  plugins.telescope.keymaps.fgr.options.desc = "Lists buffer's git commits in a range of lines.";
  plugins.telescope.keymaps.fgr.action = "git_bcommits_range";
  plugins.telescope.keymaps.fgb.options.desc = "Lists git branches with log preview.";
  plugins.telescope.keymaps.fgb.action = "git_branches";
  plugins.telescope.keymaps.fgs.options.desc =
    "Lists current changes git per file with diff preview and add action.";
  plugins.telescope.keymaps.fgs.action = "git_status";
  plugins.telescope.keymaps.fgw.options.desc = "Lists git stash items";
  plugins.telescope.keymaps.fgw.action = "git_stash";
  plugins.telescope.keymaps.fGi.options.desc = "Find by Github Issues";
  plugins.telescope.keymaps.fGi.action = "gh issues";
  plugins.telescope.keymaps.fGo.options.desc = "Find by Github Pull Requests";
  plugins.telescope.keymaps.fGo.action = "gh pull_requests";
  plugins.telescope.keymaps.fGr.options.desc = "Find by Github Actions (run)";
  plugins.telescope.keymaps.fGr.action = "gh run";
  plugins.telescope.keymaps.fGs.options.desc = "Find by Github Gist";
  plugins.telescope.keymaps.fGs.action = "gh gist";

  plugins.which-key.settings.spec = [

    {
      __unkeyed-1 = "<leader>g";
      __unkeyed-2 = "<cmd>Neogit<CR>";
      icon = icons.git;
      desc = "Open Neogit";
    }

    {
      __unkeyed-1 = "tgs";
      __unkeyed-2.__raw = gs.toggle_signs;
      desc = "Toggle Sign Column";
    }

    {
      __unkeyed-1 = "tgn";
      __unkeyed-2.__raw = gs.toggle_numhl;
      desc = "Toggle Num Hightlight";
    }

    {
      __unkeyed-1 = "tgl";
      __unkeyed-2.__raw = gs.toggle_linehl;
      desc = "Toggle Line Hightlight";
    }

    {
      __unkeyed-1 = "tgw";
      __unkeyed-2.__raw = gs.toggle_word_diff;
      desc = "Toggle Word Diff";
    }

    {
      __unkeyed-1 = "tgd";
      __unkeyed-2.__raw = gs.toggle_deleted;
      desc = "Toggle Deleted";
    }

    {
      __unkeyed-1 = "tgb";
      __unkeyed-2.__raw = gs.toggle_current_line_blame;
      desc = "Toggle Current line blame";
    }

  ];

  plugins.neogit.enable = true;
  plugins.git-conflict.enable = true;

  plugins.gitsigns.enable = true;
  plugins.gitsigns.settings.numhl = true;
  plugins.gitsigns.settings.linehl = false;
  plugins.gitsigns.settings.current_line_blame_opts.virt_text = true;
  plugins.gitsigns.settings.current_line_blame_opts.virt_text_pos = "eol";
  plugins.gitsigns.settings.current_line_blame_opts.ignore_whitespace = false;
  plugins.gitsigns.settings.signs.add.text = icons.vertical;
  plugins.gitsigns.settings.signs.change.text = icons.pipe;
  plugins.gitsigns.settings.signs.delete.text = icons.minus2;
  plugins.gitsigns.settings.signs.topdelete.text = "‾";
  plugins.gitsigns.settings.signs.changedelete.text = "~";
}
