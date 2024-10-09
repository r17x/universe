{ icons, pkgs, ... }:

{
  highlightOverride.LspInlayHint.link = "InclineNormalNc";

  extraPackages = [ pkgs.nixfmt ];

  extraPlugins = with pkgs.vimPlugins; [
    vim-rescript
    supermaven-nvim
    nlsp-settings-nvim
  ];

  # make custom command
  extraConfigLuaPre = # lua
    ''
      vim.api.nvim_create_user_command('LspInlay',function()
        vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
      end,{})
    '';

  extraConfigLuaPost = # lua
    ''
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

      -- ft:rust didn't respect my tabstop=2 - I love you but not me
      vim.g.rust_recommended_style = false

      -- supermaven
      require("supermaven-nvim").setup({
        disable_keymaps = true
      })

      -- nlsp-settings
      local nlspsettings = require("nlspsettings")
      nlspsettings.setup({
        config_home = vim.fn.expand('$HOME/.nlsp-settings'),
        local_settings_dir = ".nlsp-settings",
        local_settings_root_markers_fallback = { '.git' },
        append_default_schemas = true,
        loader = 'json'
      })
    '';

  filetype.extension = {
    "re" = "reason";
    "rei" = "reason";
  };

  plugins.which-key.settings.spec = [
    {
      __unkeyed-1 = "//";
      __unkeyed-2 = "<cmd>nohlsearch<cr>";
      desc = icons.withIcon "git" "Clear search highlight";
    }
    {
      __unkeyed-1 = "<leader><space>";
      __unkeyed-2 = "<cmd>Lspsaga term_toggle<cr>";
      desc = icons.withIcon "git" "Open Terminal";
    }
    {
      __unkeyed-1 = "ge";
      __unkeyed-2 = "<cmd>Trouble diagnostics open<cr>";
      desc = icons.withIcon "git" "Show diagnostics [Trouble]";
    }
    {
      __unkeyed-1 = "[e";
      __unkeyed-2 = "<cmd>Lspsaga diagnostic_jump_next<cr>";
      desc = icons.withIcon "git" "Next Diagnostic";
    }
    {
      __unkeyed-1 = "]e";
      __unkeyed-2 = "<cmd>Lspsaga diagnostic_jump_prev<cr>";
      desc = icons.withIcon "git" "Previous Diagnostic";
    }
    {
      __unkeyed-1 = "K";
      __unkeyed-2 = "<cmd>Lspsaga hover_doc<cr>";
      desc = icons.withIcon "git" "Code Hover";
    }
    {
      __unkeyed-1 = "F";
      __unkeyed-2 = "<cmd>lua vim.lsp.buf.format({ async = true }) <cr>";
      desc = icons.withIcon "git" "Format the current buffer";
    }
    {
      __unkeyed-1 = "gl";
      __unkeyed-2 = "<cmd>LspInfo<cr>";
      desc = icons.withIcon "git" "Show LSP Info";
    }
    {
      __unkeyed-1 = "gt";
      __unkeyed-2 = "<cmd>Lspsaga outline<cr>";
      desc = icons.withIcon "git" "Code Action";
    }
    {
      __unkeyed-1 = "ga";
      __unkeyed-2 = "<cmd>Lspsaga code_action<cr>";
      desc = icons.withIcon "git" "Code Action";
    }
    {
      __unkeyed-1 = "gi";
      __unkeyed-2 = "<cmd>Lspsaga incoming_calls<cr>";
      desc = icons.withIcon "git" "Incoming Calls";
    }
    {
      __unkeyed-1 = "go";
      __unkeyed-2 = "<cmd>Lspsaga outgoing_calls<cr>";
      desc = icons.withIcon "git" "Outgoing Calls";
    }
    {
      __unkeyed-1 = "gD";
      __unkeyed-2 = "<cmd>Lspsaga goto_definition<cr>";
      desc = icons.withIcon "git" "Go to Definition";
    }
    {
      __unkeyed-1 = "gd";
      __unkeyed-2 = "<cmd>Lspsaga peek_definition<cr>";
      desc = icons.withIcon "git" "Peek Definition";
    }
    {
      __unkeyed-1 = "gr";
      __unkeyed-2 = "<cmd>Lspsaga rename<cr>";
      desc = icons.withIcon "git" "Code Rename";
    }
    {
      __unkeyed-1 = "gs";
      __unkeyed-2 = ''<cmd>lua require("wtf").search() <cr>'';
      desc = icons.withIcon "git" "Search diagnostic with Google";
    }
    {
      __unkeyed-1 = "gcf";
      __unkeyed-2 = "<cmd>Lspsaga finder<cr>";
      desc = icons.withIcon "git" "Code Finder";
    }
    # telescope with lsp
    {
      __unkeyed-1 = "<leader>tih";
      __unkeyed-2 = "<cmd>LspInlay<cr>";
      desc = icons.withIcon "git" "Toggle Inlay Hints";
    }
    {
      __unkeyed-1 = "fnix";
      __unkeyed-2 = "<cmd>Telescope manix<cr>";
      desc = icons.withIcon "git" "Find nix with man|nix";
    }
    {
      __unkeyed-1 = "flr";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_references()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find References";
    }
    {
      __unkeyed-1 = "fic";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_incoming_calls()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Incoming Calls";
    }
    {
      __unkeyed-1 = "foc";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_outgoing_calls()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Outgoing Calls";
    }
    {
      __unkeyed-1 = "fds";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_document_symbols()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Document Symbols";
    }
    {
      __unkeyed-1 = "fws";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_workspace_symbols()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Workspace Symbols";
    }
    {
      __unkeyed-1 = "fdws";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_dynamic_workspace_symbols()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Dynamic Workspace Symbols";
    }
    {
      __unkeyed-1 = "fld";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.diagnostics()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Diagnostics";
    }
    {
      __unkeyed-1 = "fli";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_implementations()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Implementations";
    }
    {
      __unkeyed-1 = "flD";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_definitions()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Definitions";
    }
    {
      __unkeyed-1 = "flt";
      __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_type_definitions()<cr>";
      desc = icons.withIcon "git" "[Lsp] Find Type Definitions";
    }

  ];

  plugins.lsp = {
    enable = true;
    servers = {
      ccls.enable = true;
      ccls.autostart = true;

      bashls.enable = true;
      bashls.autostart = true;

      dockerls.enable = true;
      dockerls.autostart = true;

      biome.enable = true;
      biome.autostart = true;

      eslint.enable = true;
      eslint.autostart = true;

      ts_ls.enable = true;
      ts_ls.autostart = true;
      ts_ls.rootDir = # lua
        ''
          require('lspconfig.util').root_pattern('.git')
        '';

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
            fileMatch = [
              ".nixd.json"
              "nixd.json"
            ];
            url = "https://raw.githubusercontent.com/nix-community/nixd/main/nixd/docs/nixd-schema.json";
          }
          {
            description = "Turbo.build configuration file";
            fileMatch = [ "turbo.json" ];
            url = "https://turbo.build/schema.json";
          }
          {
            description = "TypeScript compiler configuration file";
            fileMatch = [
              "tsconfig.json"
              "tsconfig.*.json"
            ];
            url = "https://json.schemastore.org/tsconfig.json";
          }
          {
            description = "ReScript compiler schema";
            fileMatch = [
              "bsconfig.json"
              "rescript.json"
            ];
            url = "https://raw.githubusercontent.com/rescript-lang/rescript-compiler/87d78697d7a1eed75c9de55bbdc476540d6f77bb/docs/docson/build-schema.json";
          }
          {
            description = "ReScript v11 compiler schema ";
            fileMatch = [ "rescript.json" ];
            url = "https://raw.githubusercontent.com/rescript-lang/rescript-compiler/master/docs/docson/build-schema.json";
          }
        ];
      };

      lua_ls.enable = true;
      lua_ls.autostart = true;

      nil_ls.enable = true;
      nil_ls.autostart = true;

      rust_analyzer.enable = true;
      rust_analyzer.autostart = true;
      rust_analyzer.installCargo = false;
      rust_analyzer.installRustc = false;

      nixd.enable = true;
      nixd.autostart = true;
      nixd.rootDir = # lua
        ''
          require('lspconfig.util').root_pattern('.git', '.nixd.json')
        '';
      nixd.settings.formatting.command = [ "nixfmt" ];

      yamlls.enable = true;
      yamlls.autostart = true;
    };
  };

  plugins.lsp-format.enable = true;
  plugins.lsp-format.setup.ts.order = [
    "ts_ls"
    "eslint"
  ];
  plugins.lsp-format.setup.js.order = [
    "ts_ls"
    "eslint"
  ];

  plugins.lspkind.enable = true;
  plugins.lspkind.symbolMap.Codeium = icons.code;
  plugins.lspkind.symbolMap.Copilot = icons.robotFace;
  plugins.lspkind.symbolMap.Suggestion = icons.wand;
  plugins.lspkind.symbolMap.TabNine = icons.face;
  plugins.lspkind.symbolMap.Supermaven = icons.star;
  plugins.lspkind.symbolMap.Error = icons.cross4;
  plugins.lspkind.symbolMap.Hint = icons.hint;
  plugins.lspkind.symbolMap.Info = icons.info2;
  plugins.lspkind.symbolMap.Warn = icons.warning2;
  plugins.lspkind.symbolMap.DiagnosticSignError = icons.cross4;
  plugins.lspkind.symbolMap.DiagnosticSignHint = icons.hint;
  plugins.lspkind.symbolMap.DiagnosticSignInfo = icons.info2;
  plugins.lspkind.symbolMap.DiagnosticSignWarn = icons.warning2;
  plugins.lspkind.cmp.enable = true;
  plugins.lspkind.cmp.maxWidth = 24;
  plugins.lspkind.cmp.after = # lua
    ''
      function(entry, vim_item, kind)
        local strings = vim.split(kind.kind, "%s", { trimempty = true })
        kind.kind = " " .. (strings[1] or "") .. " "
        kind.menu = "   ⌈" .. (strings[2] or "") .. "⌋"

        return kind
      end
    '';

  plugins.lspsaga.enable = true;
  plugins.lspsaga.lightbulb.sign = false;
  plugins.lspsaga.lightbulb.virtualText = true;
  plugins.lspsaga.lightbulb.debounce = 40;
  plugins.lspsaga.ui.codeAction = icons.gearSM;

  plugins.trouble.enable = true;
  # TODO: move plugin configuration when needed secrets
  plugins.codeium-nvim.enable = true;
  plugins.codeium-nvim.settings.config_path.__raw = # lua
    ''
      vim.env.HOME .. '/.config/sops-nix/secrets/codeium'
    '';
  plugins.wtf.enable = true;
  plugins.nvim-autopairs.enable = true;

  plugins.cmp.enable = true;
  plugins.cmp.autoEnableSources = false;

  plugins.cmp.settings.experimental.ghost_text = true;

  plugins.cmp.settings.performance.debounce = 60;
  plugins.cmp.settings.performance.fetching_timeout = 200;
  plugins.cmp.settings.performance.max_view_entries = 30;

  plugins.cmp.settings.window.completion.winhighlight = "Normal:Pmenu,FloatBorder:Pmenu,Search:None";
  plugins.cmp.settings.window.completion.border = "rounded";
  plugins.cmp.settings.window.documentation.border = "rounded";
  plugins.cmp.settings.window.completion.col_offset = -3;
  plugins.cmp.settings.window.completion.side_padding = 0;

  plugins.cmp.settings.formatting.expandable_indicator = true;
  plugins.cmp.settings.formatting.fields = [
    "kind"
    "abbr"
    "menu"
  ];

  plugins.cmp.settings.mapping."<C-Space>" = "cmp.mapping.complete()";
  plugins.cmp.settings.mapping."<C-d>" = "cmp.mapping.scroll_docs(-4)";
  plugins.cmp.settings.mapping."<C-e>" = "cmp.mapping.close()";
  plugins.cmp.settings.mapping."<C-f>" = "cmp.mapping.scroll_docs(4)";
  plugins.cmp.settings.mapping."<CR>" = "cmp.mapping.confirm({ select = true })";
  plugins.cmp.settings.mapping."<S-Tab>" = "cmp.mapping(cmp.mapping.select_prev_item(), {'i', 's'})";
  plugins.cmp.settings.mapping."<Tab>" = "cmp.mapping(cmp.mapping.select_next_item(), {'i', 's'})";

  plugins.cmp.settings.snippet.expand = # lua
    ''
      function(args) require('luasnip').lsp_expand(args.body) end
    '';

  plugins.cmp-nvim-lsp.enable = true;
  plugins.cmp-nvim-lsp-document-symbol.enable = true;
  plugins.cmp-nvim-lsp-signature-help.enable = true;
  plugins.cmp_luasnip.enable = true;
  plugins.cmp-async-path.enable = true;
  plugins.cmp-buffer.enable = true;
  plugins.cmp-cmdline.enable = true;
  plugins.cmp-spell.enable = false;
  plugins.cmp-dictionary.enable = false;
  plugins.cmp-treesitter.enable = false;
  plugins.cmp-fish.enable = false;
  plugins.cmp-tmux.enable = false;
  plugins.cmp-emoji.enable = true;

  plugins.cmp.settings.sources.__raw = # lua
    ''
      cmp.config.sources({
        { name = 'nvim_lsp' },
        { name = 'nvim_lsp_signature_help' },
        { name = 'nvim_lsp_document_symbol' },
        { name = 'codeium' },
        { name = 'supermaven' },
        { name = 'luasnip' }, 
        { name = 'neorg' },
        { name = 'emoji' },
        { name = 'async_path' },
      }, {
        { name = 'buffer' },
        { name = 'cmdline' },
      })

    '';
  plugins.cmp.cmdline."/".mapping.__raw = "cmp.mapping.preset.cmdline()";
  plugins.cmp.cmdline."/".sources = [ { name = "buffer"; } ];
  plugins.cmp.cmdline."?".mapping.__raw = "cmp.mapping.preset.cmdline()";
  plugins.cmp.cmdline."?".sources = [ { name = "buffer"; } ];
  plugins.cmp.cmdline.":".mapping.__raw = "cmp.mapping.preset.cmdline()";
  plugins.cmp.cmdline.":".sources = [
    { name = "async_path"; }
    {
      name = "cmdline";
      option = {
        ignore_cmds = [
          "Man"
          "!"
        ];
      };
    }
  ];
}
