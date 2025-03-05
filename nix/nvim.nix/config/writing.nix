{
  lib,
  icons,
  pkgs,
  helpers,
  ...
}:

{
  keymaps = [
    # move lines up and down with visual selection
    # [Visual] K: move up
    # [Visual] J: move down
    {
      key = "K";
      action = ":m '<-2<CR>gv=gv";
      mode = [ "v" ];
    }
    {
      key = "J";
      action = ":m '>+1<CR>gv=gv";
      mode = [ "v" ];
    }
  ];

  userCommands.Venn.desc = "Toggle Venn";
  userCommands.Venn.command.__raw =
    helpers.mkLuaFun
      # lua
      ''
        local venn_enabled = vim.inspect(vim.b.venn_enabled)
        if venn_enabled == "nil" then
            vim.b.venn_enabled = true
            vim.cmd[[setlocal ve=all]]
            -- draw a line on HJKL keystokes
            vim.api.nvim_buf_set_keymap(0, "n", "J", "<C-v>j:VBox<CR>", {noremap = true})
            vim.api.nvim_buf_set_keymap(0, "n", "K", "<C-v>k:VBox<CR>", {noremap = true})
            vim.api.nvim_buf_set_keymap(0, "n", "L", "<C-v>l:VBox<CR>", {noremap = true})
            vim.api.nvim_buf_set_keymap(0, "n", "H", "<C-v>h:VBox<CR>", {noremap = true})
            -- draw a box by pressing "f" with visual selection
            vim.api.nvim_buf_set_keymap(0, "v", "f", ":VBox<CR>", {noremap = true})
        else
            vim.cmd[[setlocal ve=]]
            vim.api.nvim_buf_del_keymap(0, "n", "J")
            vim.api.nvim_buf_del_keymap(0, "n", "K")
            vim.api.nvim_buf_del_keymap(0, "n", "L")
            vim.api.nvim_buf_del_keymap(0, "n", "H")
            vim.api.nvim_buf_del_keymap(0, "v", "f")
            vim.b.venn_enabled = nil
        end
      '';

  extraPlugins = with pkgs.vimPlugins; [
    venn-nvim
  ];

  plugins = rec {
    lz-n.plugins = [
      {
        __unkeyed-1 = "venn.nvim";
        cmd = [ "Venn" ];
      }
    ];
    cmp.settings.sources = [
      { name = "neorg"; }
    ];

    which-key.settings.spec = [

      {
        __unkeyed-1 = "mp";
        __unkeyed-2 = "<cmd>MarkdownPreview<cr>";
        icon = icons.space.right "markdown";
        desc = "Preview Markdown";
      }

      {
        __unkeyed-1 = "tv";
        __unkeyed-2 = "<cmd>Venn<CR>";
        icon = icons.space.right "wand";
        desc = "Toggle Venn [Ascii Draw Diagram]";
      }

      {
        __unkeyed-1 = "<leader>oj";
        __unkeyed-2 = "<cmd>Neorg journal today<cr>";
        icon = icons.space.right "journal";
        desc = "Journal Today";
      }

      {
        __unkeyed-1 = "<leader>oh";
        __unkeyed-2 = "<cmd>Neorg workspace home<cr>";
        icon = icons.space.right "house";
        desc = "Open Neorg Home";
      }

      {
        __unkeyed-1 = "<leader>zm";
        __unkeyed-2 = "<cmd>ZenMode<cr>";
        icon = icons.space.right "philosopher";
        desc = "Focus like a Japanese Philosopher";
      }

    ];

    telescope = {
      enabledExtensions = [ "neorg" ];
      keymaps.fnw.options.desc = "Switch Neorg Workspace";
      keymaps.fnw.action = "neorg switch_workspace";
      keymaps.fni.options.desc = "Insert Neorg Link";
      keymaps.fni.action = "neorg insert_link";
      keymaps.fnI.options.desc = "Insert Neorg File Link";
      keymaps.fnI.action = "neorg insert_file_link";
      keymaps.fns.options.desc = "Find Neorg files";
      keymaps.fns.action = "neorg find_norg_files";
      keymaps.fnh.options.desc = "Find Neorg by Headings";
      keymaps.fnh.action = "neorg search_headings";
      keymaps.fnl.options.desc = "Find Neorg Linkable";
      keymaps.fnl.action = "neorg find_linkable";
      keymaps.fnB.options.desc = "Find Neorg Header Backlinks";
      keymaps.fnB.action = "neorg find_header_backlinks";
      keymaps.fnb.options.desc = "Find Neorg Backlinks";
      keymaps.fnb.action = "neorg find_backlinks";
      keymaps.fnt.options.desc = "Find Neorg Project Tasks";
      keymaps.fnt.action = "neorg find_project_tasks";
      keymaps.fnc.options.desc = "Find Neorg Context Tasks";
      keymaps.fnc.action = "neorg find_context_tasks";
    };

    image.enable = true;

    markdown-preview = {
      enable = true;
      autoLoad = false;
      settings.theme = "dark";
      settings.port = "8686";
    };

    comment = {
      enable = true;
      lazyLoad.settings.keys = [
        "gcc"
        "gco"
        "gcO"
        "gcA"
      ];
    };

    zen-mode = {
      enable = true;
      lazyLoad.settings.cmd = "ZenMode";
    };

    neorg = {
      enable = true;
      lazyLoad.settings.filetype = "norg";
      lazyLoad.settings.keys = lib.attrNames telescope.keymaps;
      telescopeIntegration.enable = true;
      settings.load = {
        "core.dirman" = {
          config = {
            default_workspace = "home";
            index = "index.norg";
            open_last_workspace = false;
            workspaces = {
              home = "~/.config/nixpkgs/notes";
              secret = "~/.config/nixpkgs/secrets";
            };
          };
        };
        "core.concealer" = {
          config = {
            folds = true;
            icon_preset = "diamond";
            init_open_folds = "auto";
            icons.code_block.conceal = true;
          };
        };
        "core.esupports.metagen" = {
          config = {
            author = "r17x";
            type = "auto";
          };
        };
        "core.completion".config.engine = "nvim-cmp";
        "core.presenter".config.zen_mode = "zen-mode";
        "core.summary".config.strategy = "by_path";
        "core.keybinds".config.neorg_leader = "<Leader>";
        "core.ui" = { };
        "core.ui.calendar" = { };
        "core.latex.renderer" = { };
        "core.defaults".__empty = null;
        "core.integrations.treesitter".config.install_parsers = false;
        "core.integrations.telescope" = { };
      };
    };
  };
}
