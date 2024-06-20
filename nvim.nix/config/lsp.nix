{ pkgs, ... }:

{
  highlightOverride.LspInlayHint.link = "InclineNormalNc";

  extraPackages = [ pkgs.nixpkgs-fmt ];

  extraPlugins = with pkgs.vimPlugins; [ telescope-github-nvim vim-rescript ];

  # make custom command
  extraConfigLuaPre = ''
    vim.api.nvim_create_user_command('LspInlay',function()
      local buf = vim.api.nvim_get_current_buf()
      if buf ~= nil or buf ~= 0 then
        vim.lsp.inlay_hint.enable(buf, not vim.lsp.inlay_hint.is_enabled())
      end
    end,{})
  '';

  extraConfigLuaPost = ''
    require('telescope').load_extension('gh')

    local lspconfig = require('lspconfig')
    lspconfig.rescriptls.setup{}
    lspconfig.ocamllsp.setup({
      settings = {
        codelens = { enable = false },
        extendedHover = { enable = true },
        duneDiagnostics = {enable = false },
        inlayHints = { enable = true },
      }
    })

    -- make sync formatter when write and quit
    -- vim.cmd [[ cabbrev wq execute "Format sync" <bar> wq ]]

    -- ft:rust didn't respect my tabstop=2 - I love you but not me
    vim.g.rust_recommended_style = false
  '';

  filetype.extension = { "re" = "reason"; "rei" = "reason"; };

  plugins.which-key.registrations = {
    "//" = [ "<cmd>nohlsearch<cr>" "Clear search highlight" ];
    "<leader><space>" = [ "<cmd>Lspsaga term_toggle<cr>" "Open Terminal" ];
    "ge" = [ "<cmd>Trouble<cr>" "Show diagnostics [Trouble]" ];
    "[e" = [ "<cmd>Lspsaga diagnostic_jump_next<cr>" "Next Diagnostic" ];
    "]e" = [ "<cmd>Lspsaga diagnostic_jump_prev<cr>" "Previous Diagnostic" ];
    "K" = [ "<cmd>Lspsaga hover_doc<cr>" "Code Hover" ];
    "F" = [ "<cmd>lua vim.lsp.buf.format({ async = true }) <cr>" "Format the current buffer" ];
    "gl" = [ "<cmd>LspInfo<cr>" "Show LSP Info" ];
    "gt" = [ "<cmd>Lspsaga outline<cr>" "Code Action" ];
    "ga" = [ "<cmd>Lspsaga code_action<cr>" "Code Action" ];
    "gi" = [ "<cmd>Lspsaga incoming_calls<cr>" "Incoming Calls" ];
    "go" = [ "<cmd>Lspsaga outgoing_calls<cr>" "Outgoing Calls" ];
    "gD" = [ "<cmd>Lspsaga goto_definition<cr>" "Go to Definition" ];
    "gd" = [ "<cmd>Lspsaga peek_definition<cr>" "Peek Definition" ];
    "gr" = [ "<cmd>Lspsaga rename<cr>" "Code Rename" ];
    "gs" = [ ''<cmd>lua require("wtf").search() <cr>'' "Search diagnostic with Google" ];
    "gcf" = [ "<cmd>Lspsaga finder<cr>" "Code Finder" ];
    # telescope with lsp
    "<leader>tih" = [ "<cmd>LspInlay<cr>" "Toggle Inlay Hints" ];
    "fnix" = [ "<cmd>Telescope manix<cr>" "Find nix with man|nix" ];
    "flr" = [ "<cmd>lua require'telescope.builtin'.lsp_references()<cr>" "[Lsp] Find References" ];
    "fic" = [ "<cmd>lua require'telescope.builtin'.lsp_incoming_calls()<cr>" "[Lsp] Find Incoming Calls" ];
    "foc" = [ "<cmd>lua require'telescope.builtin'.lsp_outgoing_calls()<cr>" "[Lsp] Find Outgoing Calls" ];
    "fds" = [ "<cmd>lua require'telescope.builtin'.lsp_document_symbols()<cr>" "[Lsp] Find Document Symbols" ];
    "fws" = [ "<cmd>lua require'telescope.builtin'.lsp_workspace_symbols()<cr>" "[Lsp] Find Workspace Symbols" ];
    "fdws" = [ "<cmd>lua require'telescope.builtin'.lsp_dynamic_workspace_symbols()<cr>" "[Lsp] Find Dynamic Workspace Symbols" ];
    "fld" = [ "<cmd>lua require'telescope.builtin'.diagnostics()<cr>" "[Lsp] Find Diagnostics" ];
    "fli" = [ "<cmd>lua require'telescope.builtin'.lsp_implementations()<cr>" "[Lsp] Find Implementations" ];
    "flD" = [ "<cmd>lua require'telescope.builtin'.lsp_definitions()<cr>" "[Lsp] Find Definitions" ];
    "flt" = [ "<cmd>lua require'telescope.builtin'.lsp_type_definitions()<cr>" "[Lsp] Find Type Definitions" ];
  };

  plugins.lsp = {
    enable = true;
    onAttach = builtins.readFile ./lsp.onAttach.lua;
    postConfig = builtins.readFile ./lsp.postConfig.lua;
    servers = {
      ccls.enable = true;
      ccls.autostart = true;

      bashls.enable = true;
      bashls.autostart = true;

      dockerls.enable = true;
      dockerls.autostart = true;

      eslint.enable = true;
      eslint.autostart = true;

      gopls.enable = true;
      gopls.autostart = true;
      gopls.extraOptions.settings.gopls.hints = {
        assignVariableTypes = true;
        compositeLiteralFields = true;
        compositeLiteralTypes = true;
        constantValues = true;
        functionTypeParameters = true;
        parameterNames = true;
        rangeVariableTypes = true;
      };

      hls.enable = true;
      hls.autostart = true;

      htmx.enable = !pkgs.stdenv.isDarwin;
      htmx.autostart = true;

      jsonls.enable = true;
      jsonls.autostart = true;
      jsonls.extraOptions.settings.json = {
        validate.enable = true;
        schemas = [
          {
            description = "nixd schema";
            fileMatch = [ ".nixd.json" ];
            url = "https://raw.githubusercontent.com/nix-community/nixd/main/nixd/docs/nixd-schema.json";
          }
          {
            description = "Turbo.build configuration file";
            fileMatch = [ "turbo.json" ];
            url = "https://turbo.build/schema.json";
          }
          {
            description = "TypeScript compiler configuration file";
            fileMatch = [ "tsconfig.json" "tsconfig.*.json" ];
            url = "https://json.schemastore.org/tsconfig.json";
          }
          {
            description = "ReScript compiler schema";
            fileMatch = [ "bsconfig.json" "rescript.json" ];
            url = "https://raw.githubusercontent.com/rescript-lang/rescript-compiler/87d78697d7a1eed75c9de55bbdc476540d6f77bb/docs/docson/build-schema.json";
          }
          {
            description = "ReScript v11 compiler schema ";
            fileMatch = [ "rescript.json" ];
            url = "https://raw.githubusercontent.com/rescript-lang/rescript-compiler/master/docs/docson/build-schema.json";
          }
        ];
      };

      lua-ls.enable = true;
      lua-ls.autostart = true;

      nil_ls.enable = true;
      nil_ls.autostart = true;

      rust-analyzer.enable = true;
      rust-analyzer.autostart = true;
      rust-analyzer.installCargo = false;
      rust-analyzer.installRustc = false;

      tsserver.enable = true;
      tsserver.autostart = true;

      tsserver.extraOptions.settings =
        let
          inlayHints = {
            includeInlayParameterNameHints = "all";
            includeInlayParameterNameHintsWhenArgumentMatchesName = false;
            includeInlayEnumMemberValueHints = true;
            includeInlayFunctionLikeReturnTypeHints = false;
            includeInlayFunctionParameterTypeHints = true;
            includeInlayPropertyDeclarationTypeHints = true;
            includeInlayVariableTypeHints = true;
          };
        in
        {
          javascript = { inherit inlayHints; };
          typescript = { inherit inlayHints; };
        };

      nixd.enable = true;
      nixd.autostart = true;

      yamlls.enable = true;
      yamlls.autostart = true;
    };
  };

  plugins.lsp-format.enable = true;
  plugins.lsp-format.setup.ts.order = [ "tsserver" "eslint" ];
  plugins.lsp-format.setup.js.order = [ "tsserver" "eslint" ];

  plugins.lspkind.enable = true;
  plugins.lspkind.cmp.enable = true;
  plugins.lspsaga = {
    enable = true;
    lightbulb.sign = false;
    lightbulb.virtualText = true;
    lightbulb.debounce = 40;
    ui.codeAction = "⛭";
  };

  plugins.trouble.enable = true;
  # TODO: move plugin configuration when needed secrets
  plugins.codeium-nvim.enable = true;
  plugins.codeium-nvim.configPath.__raw = "vim.env.HOME .. '/.config/sops-nix/secrets/codeium'";
  plugins.wtf.enable = true;
  plugins.nvim-autopairs.enable = true;

  plugins.cmp = {
    enable = true;
    settings = {
      mapping = {
        "<C-Space>" = "cmp.mapping.complete()";
        "<C-d>" = "cmp.mapping.scroll_docs(-4)";
        "<C-e>" = "cmp.mapping.close()";
        "<C-f>" = "cmp.mapping.scroll_docs(4)";
        "<CR>" = "cmp.mapping.confirm({ select = true })";
        "<S-Tab>" = "cmp.mapping(cmp.mapping.select_prev_item(), {'i', 's'})";
        "<Tab>" = "cmp.mapping(cmp.mapping.select_next_item(), {'i', 's'})";
      };

      sources = [
        { name = "nvim_lsp"; }
        { name = "nvim_lsp_signature_help"; }
        { name = "nvim_lsp_document_symbol"; }
        { name = "codeium"; }
        { name = "luasnip"; } #For luasnip users.
        { name = "path"; }
        { name = "buffer"; }
        { name = "cmdline"; }
        { name = "neorg"; }
        # { name = "spell"; }
        # { name = "dictionary"; }
        # { name = "treesitter"; }
      ];

    };
  };
  plugins.cmp-nvim-lsp.enable = true;
  plugins.cmp-nvim-lsp-document-symbol.enable = true;
  plugins.cmp-nvim-lsp-signature-help.enable = true;
  plugins.cmp_luasnip.enable = true;
  plugins.cmp-path.enable = true;
  plugins.cmp-buffer.enable = true;
  plugins.cmp-cmdline.enable = true;
  plugins.cmp-spell.enable = false;
  plugins.cmp-dictionary.enable = false;
  plugins.cmp-treesitter.enable = false;
  plugins.cmp-fish.enable = false;
  plugins.cmp-tmux.enable = false;
}
