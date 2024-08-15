{ pkgs, ... }:

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

  autoCmd = [
    {
      event = [ "BufEnter" ];
      pattern = [ "*.norg" ];
      command = "setlocal wrap";
    }
  ];

  extraPlugins = with pkgs.vimPlugins; [
    neorg-telescope
    venn-nvim
  ];

  extraConfigLuaPost = # lua
    ''
      require("telescope").load_extension "neorg"
    '';

  extraConfigLuaPre = # lua
    ''
      -- venn.nvim: enable or disable keymappings
      function _G.Toggle_venn()
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
      end
    '';

  plugins.which-key.registrations."mp" = [
    "<cmd>MarkdownPreview<cr>"
    "Preview Markdown"
  ];
  plugins.which-key.registrations."<leader>tv" = [
    ":lua Toggle_venn()<CR>"
    "Toggle Venn"
  ];

  plugins.which-key.registrations."<leader>oj" = [
    "<cmd>Neorg journal today<cr>"
    "Journal Today"
  ];
  plugins.which-key.registrations."<leader>oh" = [
    "<cmd>Neorg workspace home<cr>"
    "Open Neorg Home"
  ];
  plugins.which-key.registrations."<leader>zm" = [
    "<cmd>ZenMode<cr>"
    "Focus like a Japanese Philosopher 🧘"
  ];

  plugins.comment.enable = true;
  plugins.zen-mode.enable = true;
  plugins.neorg = {
    enable = true;
    lazyLoading = true;
    modules = {
      "core.dirman" = {
        config = {
          default_workspace = "home";
          index = "index.norg";
          open_last_workspace = true;
          workspaces = {
            home = "~/.config/nixpkgs/notes";
            secret = "~/.config/nixpkgs/secrets";
          };

        };
      };
      "core.highlights" = { };
      "core.defaults" = {
        __empty = null;
      };
      "core.keybinds" = {
        config.neorg_leader = "<Leader>";
      };
      "core.integrations.treesitter" = {
        config.install_parsers = false;
      };
      "core.integrations.telescope" = { };
      "core.concealer" = {
        config = {
          folds = true;
          icon_preset = "diamond";
          init_open_folds = "auto";
          icons.code_block.conceal = true;
        };
      };
      "core.completion" = {
        config = {
          engine = "nvim-cmp";
        };
      };
      "core.esupports.metagen" = {
        config = {
          author = "r17x";
          type = "auto";
        };
      };
      "core.presenter" = {
        config = {
          zen_mode = "zen-mode";
        };
      };
      "core.summary" = {
        config.strategy = "by_path";
      };
      "core.ui" = { };
      "core.ui.calendar" = { };
    };
  };

  plugins.markdown-preview = {
    enable = true;
    settings.theme = "dark";
    settings.port = "8686";
  };

}
