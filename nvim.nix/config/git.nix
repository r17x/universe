{ icons, helpers, ... }:

let
  inherit (helpers) mkRaw;

  gs.toggle_signs = mkRaw "require'gitsigns'.toggle_signs";
  gs.toggle_numhl = mkRaw "require'gitsigns'.toggle_numhl";
  gs.toggle_linehl = mkRaw "require'gitsigns'.toggle_linehl";
  gs.toggle_word_diff = mkRaw "require'gitsigns'.toggle_word_diff";
  gs.toggle_deleted = mkRaw "require'gitsigns'.toggle_deleted";
  gs.toggle_current_line_blame = mkRaw "require'gitsigns'.toggle_current_line_blame";

in

{
  plugins.which-key.settings.spec = [
    {
      __unkeyed-1 = "mg";
      __unkeyed-2 = "<cmd>Neogit<CR>";
      desc = icons.withIcon "git" "Open Neogit";
    }
    {
      __unkeyed-1 = "<leader>gss";
      __unkeyed-2 = gs.toggle_signs;
      desc = icons.withIcon "git" "Toggle Sign Column";
    }
    {
      __unkeyed-1 = "<leader>gsn";
      __unkeyed-2 = gs.toggle_numhl;
      desc = icons.withIcon "git" "Toggle Num Hightlight";
    }
    {
      __unkeyed-1 = "<leader>gsl";
      __unkeyed-2 = gs.toggle_linehl;
      desc = icons.withIcon "git" "Toggle Line Hightlight";
    }
    {
      __unkeyed-1 = "<leader>gsw";
      __unkeyed-2 = gs.toggle_word_diff;
      desc = icons.withIcon "git" "Toggle Word Diff";
    }
    {
      __unkeyed-1 = "<leader>gsd";
      __unkeyed-2 = gs.toggle_deleted;
      desc = icons.withIcon "git" "Toggle Deleted";
    }
    {
      __unkeyed-1 = "<leader>gsb";
      __unkeyed-2 = gs.toggle_current_line_blame;
      desc = icons.withIcon "git" "Toggle Current line blame";
    }

    {
      __unkeyed-1 = "fghi";
      __unkeyed-2 = "<cmd>Telescope gh issues<cr>";
    }
    {
      __unkeyed-1 = "fghp";
      __unkeyed-2 = "<cmd>Telescope gh pull_request<cr>";
    }
    {
      __unkeyed-1 = "fghg";
      __unkeyed-2 = "<cmd>Telescope gh gist<cr>";
    }
    {
      __unkeyed-1 = "fghr";
      __unkeyed-2 = "<cmd>Telescope gh run<cr>";
    }

    {
      __unkeyed-1 = "fgc";
      __unkeyed-2 = "<cmd>Telescope git_commits<cr>";
      desc = icons.withIcon "git" "Lists git commits with diff preview, checkout action <cr>, reset mixed <C-r>m, reset soft <C-r>s and reset hard <C-r>h";
    }
    {
      __unkeyed-1 = "fgf";
      __unkeyed-2 = "<cmd>Telescope git_bcommits<cr>";
      desc = icons.withIcon "git" "Lists buffer's git commits with diff preview and checks them out on <cr>";
    }
    {
      __unkeyed-1 = "fgr";
      __unkeyed-2 = "<cmd>Telescope git_bcommits_range<cr>";
      desc = icons.withIcon "git" "Lists buffer's git commits in a range of lines. Use options from and to to specify the range. In visual mode, lists commits for the selected lines";
    }
    {
      __unkeyed-1 = "fgb";
      __unkeyed-2 = "<cmd>Telescope git_branches<cr>";
      desc = icons.withIcon "git" "Lists all branches with log preview, checkout action <cr>, track action <C-t>, rebase action<C-r>, create action <C-a>, switch action <C-s>, delete action <C-d> and merge action <C-y>";
    }
    {
      __unkeyed-1 = "fgs";
      __unkeyed-2 = "<cmd>Telescope git_status<cr>";
      desc = icons.withIcon "git" "Lists current changes per file with diff preview and add action. (Multi-selection still WIP)";
    }
    {
      __unkeyed-1 = "fgw";
      __unkeyed-2 = "<cmd>Telescope git_stash<cr>";
      desc = icons.withIcon "git" "Lists stash items in current repository with ability to apply them on <cr>";
    }
  ];

  plugins.neogit.enable = true;
  plugins.git-conflict.enable = true;

  plugins.gitsigns = {
    enable = true;
    settings.numhl = true;
    settings.linehl = false;
    settings.current_line_blame_opts.virt_text = true;
    settings.current_line_blame_opts.virt_text_pos = "eol";
    settings.current_line_blame_opts.ignore_whitespace = false;
    settings.signs.add.text = icons.plus2;
    settings.signs.change.text = "┃";
    settings.signs.delete.text = icons.minus2;
    settings.signs.topdelete.text = "‾";
    settings.signs.changedelete.text = "~";
  };
}
