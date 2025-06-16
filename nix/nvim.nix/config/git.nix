{
  lib,
  pkgs,
  icons,
  ...
}:

{
  extraPackages = [ pkgs.gh ];

  extraPlugins = [ pkgs.vimPlugins.telescope-github-nvim ];

  plugins = {
    telescope = rec {
      enabledExtensions = [ "gh" ];
      lazyLoad.settings.keys = lib.attrNames keymaps;
      keymaps.fgc.options.desc = "Lists git commits.";
      keymaps.fgc.action = "git_commits";
      keymaps.fgf.options.desc = "Lists buffer's git commits.";
      keymaps.fgf.action = "git_bcommits";
      keymaps.fgr.options.desc = "Lists buffer's git commits in a range of lines.";
      keymaps.fgr.action = "git_bcommits_range";
      keymaps.fgb.options.desc = "Lists git branches with log preview.";
      keymaps.fgb.action = "git_branches";
      keymaps.fgs.options.desc = "Lists current changes git per file with diff preview and add action.";
      keymaps.fgs.action = "git_status";
      keymaps.fgw.options.desc = "Lists git stash items";
      keymaps.fgw.action = "git_stash";
      keymaps.fGi.options.desc = "Find by Github Issues";
      keymaps.fGi.action = "gh issues";
      keymaps.fGo.options.desc = "Find by Github Pull Requests";
      keymaps.fGo.action = "gh pull_requests";
      keymaps.fGr.options.desc = "Find by Github Actions (run)";
      keymaps.fGr.action = "gh run";
      keymaps.fGs.options.desc = "Find by Github Gist";
      keymaps.fGs.action = "gh gist";
    };

    which-key.settings.spec =
      let
        gs.toggle_signs = "require'gitsigns'.toggle_signs";
        gs.toggle_numhl = "require'gitsigns'.toggle_numhl";
        gs.toggle_linehl = "require'gitsigns'.toggle_linehl";
        gs.toggle_word_diff = "require'gitsigns'.toggle_word_diff";
        gs.toggle_deleted = "require'gitsigns'.toggle_deleted";
        gs.toggle_current_line_blame = "require'gitsigns'.toggle_current_line_blame";
      in
      [

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

    neogit.enable = true;
    neogit.lazyLoad.settings.cmd = "Neogit";

    git-conflict.enable = true;

    gitsigns = {
      enable = true;
      settings.numhl = true;
      settings.linehl = false;
      settings.current_line_blame_opts.virt_text = true;
      settings.current_line_blame_opts.virt_text_pos = "eol";
      settings.current_line_blame_opts.ignore_whitespace = false;
      settings.signs.add.text = icons.vertical;
      settings.signs.change.text = icons.pipe;
      settings.signs.delete.text = icons.minus2;
      settings.signs.topdelete.text = "‾";
      settings.signs.changedelete.text = "~";
    };
  };
}
