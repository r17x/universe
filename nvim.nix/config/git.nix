{ helpers, ... }:

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
  plugins.which-key.registrations = {
    "mg" = [ "<cmd>Neogit<CR>" "Open Neogit" ];
    "<leader>gss" = [ gs.toggle_signs "Toggle Sign Column" ];
    "<leader>gsn" = [ gs.toggle_numhl "Toggle Num Hightlight" ];
    "<leader>gsl" = [ gs.toggle_linehl "Toggle Line Hightlight" ];
    "<leader>gsw" = [ gs.toggle_word_diff "Toggle Word Diff" ];
    "<leader>gsd" = [ gs.toggle_deleted "Toggle Deleted" ];
    "<leader>gsb" = [ gs.toggle_current_line_blame "Toggle Current line blame" ];

    "fghi" = [ "<cmd>Telescope gh issues<cr>" ];
    "fghp" = [ "<cmd>Telescope gh pull_request<cr>" ];
    "fghg" = [ "<cmd>Telescope gh gist<cr>" ];
    "fghr" = [ "<cmd>Telescope gh run<cr>" ];

    "fgc" = [ "<cmd>Telescope git_commits<cr>" "Lists git commits with diff preview, checkout action <cr>, reset mixed <C-r>m, reset soft <C-r>s and reset hard <C-r>h" ];
    "fgf" = [ "<cmd>Telescope git_bcommits<cr>" "Lists buffer's git commits with diff preview and checks them out on <cr>" ];
    "fgr" = [ "<cmd>Telescope git_bcommits_range<cr>" "Lists buffer's git commits in a range of lines. Use options from and to to specify the range. In visual mode, lists commits for the selected lines" ];
    "fgb" = [ "<cmd>Telescope git_branches<cr>" "Lists all branches with log preview, checkout action <cr>, track action <C-t>, rebase action<C-r>, create action <C-a>, switch action <C-s>, delete action <C-d> and merge action <C-y>" ];
    "fgs" = [ "<cmd>Telescope git_status<cr>" "Lists current changes per file with diff preview and add action. (Multi-selection still WIP)" ];
    "fgw" = [ "<cmd>Telescope git_stash<cr>" "Lists stash items in current repository with ability to apply them on <cr>" ];
  };

  plugins.neogit.enable = true;
  plugins.git-conflict.enable = true;

  plugins.gitsigns = {
    enable = true;
    settings.numhl = true;
    settings.linehl = false;
    settings.current_line_blame_opts.virt_text = true;
    settings.current_line_blame_opts.virt_text_pos = "eol";
    settings.current_line_blame_opts.ignore_whitespace = false;
    # settings.signs.add.hl = "GitSignsAdd";
    # settings.signs.add.numhl = "GitSignsAddNr";
    # settings.signs.add.linehl = "GitSignsAddLn";
    settings.signs.add.text = "┃";
    # settings.signs.change.hl = "GitSignsChange";
    # settings.signs.change.numhl = "GitSignsChangeNr";
    # settings.signs.change.linehl = "GitSignsChangeLn";
    settings.signs.change.text = "┃";
    # settings.signs.delete.hl = "GitSignsDelete";
    settings.signs.delete.text = "";
    # settings.signs.delete.numhl = "GitSignsDeleteNr";
    # settings.signs.delete.linehl = "GitSignsDeleteLn";
    # settings.signs.topdelete.hl = "GitSignsDelete";
    # settings.signs.topdelete.numhl = "GitSignsDeleteNr";
    # settings.signs.topdelete.linehl = "GitSignsDeleteLn";
    settings.signs.topdelete.text = "‾";
    # settings.signs.changedelete.hl = "DiffDelete";
    # settings.signs.changedelete.numhl = "GitSignsChangeNr";
    # settings.signs.changedelete.linehl = "GitSignsChangeLn";
    settings.signs.changedelete.text = "~";
  };
}
