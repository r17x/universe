{ pkgs, ... }:

{
  autoCmd = [
    {
      event = [ "BufEnter" ];
      pattern = [ "*.norg" ];
      command = "setlocal wrap";
    }
  ];

  extraPlugins = with pkgs.vimPlugins; [ neorg-telescope venn-nvim ];

  extraConfigLuaPre = ''
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


  plugins.which-key.registrations."mp" = [ "<cmd>MarkdownPreview<cr>" "Preview Markdown" ];
  plugins.which-key.registrations."<leader>tv" = [ ":lua Toggle_venn()<CR>" "Toggle Venn" ];

  plugins.which-key.registrations."<leader>oj" = [ "<cmd>Neorg journal today<cr>" "Journal Today" ];
  plugins.which-key.registrations."<leader>oh" = [ "<cmd>Neorg workspace home<cr>" "Open Neorg Home" ];
  plugins.which-key.registrations."<leader>zm" = [ "<cmd>ZenMode<cr>" "Focus like a Japanese Philosopher 🧘" ];

  plugins.neorg.enable = true;
  plugins.neorg.lazyLoading = true;
  plugins.neorg.modules = {
    "core.defaults" = { __empty = null; };
    "core.integrations.treesitter" = { };
    "core.integrations.telescope" = { };
    "core.concealer" = { config = { folds = true; icon_preset = "diamond"; init_open_folds = "auto"; }; };
    "core.completion" = {
      config = {
        engine = "nvim-cmp";
      };
    };
    "core.dirman" = {
      config = {
        workspaces = {
          home = "~/.config/nixpkgs/notes";
        };
      };
    };
    "core.esupports.metagen" = {
      config = {
        type = "auto";
      };
    };
  };

  plugins.markdown-preview = {
    enable = true;
    settings.theme = "dark";
    settings.port = "8686";
  };

  plugins.zen-mode = {
    enable = true;
  };
}
