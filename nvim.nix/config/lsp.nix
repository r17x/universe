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
        local buf = vim.api.nvim_get_current_buf()
        if buf ~= nil or buf ~= 0 then
          vim.lsp.inlay_hint.enable(buf, not vim.lsp.inlay_hint.is_enabled())
        end
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

  plugins.which-key.registrations = {
    "//" = [
      "<cmd>nohlsearch<cr>"
      "Clear search highlight"
    ];
    "<leader><space>" = [
      "<cmd>Lspsaga term_toggle<cr>"
      "Open Terminal"
    ];
    "ge" = [
      "<cmd>Trouble<cr>"
      "Show diagnostics [Trouble]"
    ];
    "[e" = [
      "<cmd>Lspsaga diagnostic_jump_next<cr>"
      "Next Diagnostic"
    ];
    "]e" = [
      "<cmd>Lspsaga diagnostic_jump_prev<cr>"
      "Previous Diagnostic"
    ];
    "K" = [
      "<cmd>Lspsaga hover_doc<cr>"
      "Code Hover"
    ];
    "F" = [
      "<cmd>lua vim.lsp.buf.format({ async = true }) <cr>"
      "Format the current buffer"
    ];
    "gl" = [
      "<cmd>LspInfo<cr>"
      "Show LSP Info"
    ];
    "gt" = [
      "<cmd>Lspsaga outline<cr>"
      "Code Action"
    ];
    "ga" = [
      "<cmd>Lspsaga code_action<cr>"
      "Code Action"
    ];
    "gi" = [
      "<cmd>Lspsaga incoming_calls<cr>"
      "Incoming Calls"
    ];
    "go" = [
      "<cmd>Lspsaga outgoing_calls<cr>"
      "Outgoing Calls"
    ];
    "gD" = [
      "<cmd>Lspsaga goto_definition<cr>"
      "Go to Definition"
    ];
    "gd" = [
      "<cmd>Lspsaga peek_definition<cr>"
      "Peek Definition"
    ];
    "gr" = [
      "<cmd>Lspsaga rename<cr>"
      "Code Rename"
    ];
    "gs" = [
      ''<cmd>lua require("wtf").search() <cr>''
      "Search diagnostic with Google"
    ];
    "gcf" = [
      "<cmd>Lspsaga finder<cr>"
      "Code Finder"
    ];
    # telescope with lsp
    "<leader>tih" = [
      "<cmd>LspInlay<cr>"
      "Toggle Inlay Hints"
    ];
    "fnix" = [
      "<cmd>Telescope manix<cr>"
      "Find nix with man|nix"
    ];
    "flr" = [
      "<cmd>lua require'telescope.builtin'.lsp_references()<cr>"
      "[Lsp] Find References"
    ];
    "fic" = [
      "<cmd>lua require'telescope.builtin'.lsp_incoming_calls()<cr>"
      "[Lsp] Find Incoming Calls"
    ];
    "foc" = [
      "<cmd>lua require'telescope.builtin'.lsp_outgoing_calls()<cr>"
      "[Lsp] Find Outgoing Calls"
    ];
    "fds" = [
      "<cmd>lua require'telescope.builtin'.lsp_document_symbols()<cr>"
      "[Lsp] Find Document Symbols"
    ];
    "fws" = [
      "<cmd>lua require'telescope.builtin'.lsp_workspace_symbols()<cr>"
      "[Lsp] Find Workspace Symbols"
    ];
    "fdws" = [
      "<cmd>lua require'telescope.builtin'.lsp_dynamic_workspace_symbols()<cr>"
      "[Lsp] Find Dynamic Workspace Symbols"
    ];
    "fld" = [
      "<cmd>lua require'telescope.builtin'.diagnostics()<cr>"
      "[Lsp] Find Diagnostics"
    ];
    "fli" = [
      "<cmd>lua require'telescope.builtin'.lsp_implementations()<cr>"
      "[Lsp] Find Implementations"
    ];
    "flD" = [
      "<cmd>lua require'telescope.builtin'.lsp_definitions()<cr>"
      "[Lsp] Find Definitions"
    ];
    "flt" = [
      "<cmd>lua require'telescope.builtin'.lsp_type_definitions()<cr>"
      "[Lsp] Find Type Definitions"
    ];
  };

  plugins.lsp = {
    enable = true;
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

      lua-ls.enable = true;
      lua-ls.autostart = true;

      nil-ls.enable = true;
      nil-ls.autostart = true;

      rust-analyzer.enable = true;
      rust-analyzer.autostart = true;
      rust-analyzer.installCargo = false;
      rust-analyzer.installRustc = false;

      tsserver.enable = true;
      tsserver.autostart = true;
      tsserver.rootDir = # lua
        ''
          require('lspconfig.util').root_pattern('.git')
        '';

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
    "tsserver"
    "eslint"
  ];
  plugins.lsp-format.setup.js.order = [
    "tsserver"
    "eslint"
  ];

  plugins.lspkind.enable = true;
  plugins.lspkind.symbolMap.Codeium = icons.code;
  plugins.lspkind.symbolMap.Copilot = icons.robotFace;
  plugins.lspkind.symbolMap.Suggestion = icons.wand;
  plugins.lspkind.symbolMap.TabNine = icons.face;
  plugins.lspkind.symbolMap.Supermaven = icons.star;
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
  plugins.codeium-nvim.configPath.__raw = # lua
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
