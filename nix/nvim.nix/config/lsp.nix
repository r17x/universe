{
  lib,
  icons,
  pkgs,
  helpers,
  system,
  inputs,
  ...
}:

{
  highlightOverride.LspInlayHint.link = "InclineNormalNc";

  extraPlugins = with pkgs.vimPlugins; [
    codi-vim # repl
    vim-rescript
    neorepl-nvim
    luasnip
  ];

  # make custom command
  userCommands = {
    LspInlay.desc = "Toggle Inlay Hints";
    LspInlay.command.__raw =
      helpers.mkLuaFun
        # lua
        ''
          vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
        '';
  };

  autoCmd = [
    {
      event = [
        "BufEnter"
        "VimEnter"
      ];
      pattern = [
        ".res"
        ".resi"
      ];
      callback.__raw =
        helpers.mkLuaFun # lua
          ''
            require('lspconfig').rescriptls.setup({})
          '';
    }
    {
      event = [ "LspAttach" ];
      callback.__raw = # lua
        ''
          function()
            local bufnr = vim.api.nvim_get_current_buf()
            local clients = vim.lsp.buf_get_clients()
            local is_biome_active = function()
              for _, client in ipairs(clients) do
                if client.name == "biome" and client.attached_buffers[bufnr] then
                  return true
                end
              end
              return false
            end

            for _, client in ipairs(clients) do
              if is_biome_active() then
                if client.name == "typescript-tools" or client.name == "jsonls" then
                  client.server_capabilities.documentFormattingProvider = false
                  client.server_capabilities.documentRangeFormattingProvider = false
                end
                if client.name == "eslint" then
                  client.stop()
                end
              end
            end
          end
        '';
    }
  ];

  extraConfigLuaPost = # ft:rust didn't respect my tabstop=2 - I love you but not me
    ''
      vim.g.rust_recommended_style = false
    '';

  filetype.extension = {
    "re" = "reason";
    "rei" = "reason";
  };

  plugins = {
    which-key.settings.spec = [
      {
        __unkeyed-1 = "<leader>r";
        __unkeyed-2 = "<cmd>Repl<cr>";
        desc = "Open Repl";
      }
      {
        __unkeyed-1 = "//";
        __unkeyed-2 = "<cmd>nohlsearch<cr>";
        desc = "Clear search highlight";
      }
      {
        __unkeyed-1 = "<leader><space>";
        __unkeyed-2 = "<cmd>Lspsaga term_toggle<cr>";
        desc = "Open Terminal";

      }
      {
        __unkeyed-1 = "ge";
        __unkeyed-2 = "<cmd>Trouble<cr>";
        desc = "Show diagnostics";

      }
      {
        __unkeyed-1 = "[e";
        __unkeyed-2 = "<cmd>Lspsaga diagnostic_jump_next<cr>";
        desc = "Next Diagnostic";

      }
      {
        __unkeyed-1 = "]e";
        __unkeyed-2 = "<cmd>Lspsaga diagnostic_jump_prev<cr>";
        desc = "Previous Diagnostic";

      }
      {
        __unkeyed-1 = "K";
        __unkeyed-2 = "<cmd>Lspsaga hover_doc<cr>";
        desc = "Code Hover";

      }
      {
        __unkeyed-1 = "F";
        __unkeyed-2 = "<cmd>Format<cr>";
        desc = "Format the current buffer";

      }
      {
        __unkeyed-1 = "gl";
        __unkeyed-2 = "<cmd>LspInfo<cr>";
        desc = "Show LSP Info";

      }
      {
        __unkeyed-1 = "gt";
        __unkeyed-2 = "<cmd>Lspsaga outline<cr>";
        desc = "Code Outline";

      }
      {
        __unkeyed-1 = "ga";
        __unkeyed-2 = "<cmd>Lspsaga code_action<cr>";
        desc = "Code Action";

      }
      {
        __unkeyed-1 = "gi";
        __unkeyed-2 = "<cmd>Lspsaga incoming_calls<cr>";
        desc = "Incoming Calls";

      }
      {
        __unkeyed-1 = "go";
        __unkeyed-2 = "<cmd>Lspsaga outgoing_calls<cr>";
        desc = "Outgoing Calls";

      }
      {
        __unkeyed-1 = "gD";
        __unkeyed-2 = "<cmd>Lspsaga goto_definition<cr>";
        desc = "Go to Definition";

      }
      {
        __unkeyed-1 = "gd";
        __unkeyed-2 = "<cmd>Lspsaga peek_definition<cr>";
        desc = "Peek Definition";

      }
      {
        __unkeyed-1 = "gr";
        __unkeyed-2 = "<cmd>Lspsaga rename<cr>";
        desc = "Code Rename";
        icon = icons.gearSM;

      }
      {
        __unkeyed-1 = "gs";
        __unkeyed-2 = ''<cmd>lua require("wtf").search() <cr>'';
        desc = "Search diagnostic with Google";

      }
      {
        __unkeyed-1 = "gF";
        __unkeyed-2 = "<cmd>Lspsaga finder<cr>";
        desc = "Code Finder";

      }
      {
        __unkeyed-1 = "tI";
        __unkeyed-2 = "<cmd>LspInlay<cr>";
        desc = "Toggle Inlay Hints";

      }
      {
        __unkeyed-1 = "flr";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_references()<cr>";
        desc = "[Lsp] Find References";
      }
      {
        __unkeyed-1 = "fic";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_incoming_calls()<cr>";

      }
      {
        __unkeyed-1 = "foc";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_outgoing_calls()<cr>";
        desc = "[Lsp] Find Outgoing Calls";
      }
      {
        __unkeyed-1 = "fds";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_document_symbols()<cr>";
        desc = "[Lsp] Find Document Symbols";
      }
      {
        __unkeyed-1 = "fws";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_workspace_symbols()<cr>";
        desc = "[Lsp] Find Workspace Symbols";
      }
      {
        __unkeyed-1 = "fdws";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_dynamic_workspace_symbols()<cr>";
        desc = "[Lsp] Find Dynamic Workspace Symbols";
      }
      {
        __unkeyed-1 = "fld";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.diagnostics()<cr>";
        desc = "[Lsp] Find Diagnostics";
      }
      {
        __unkeyed-1 = "fli";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_implementations()<cr>";
        desc = "[Lsp] Find Implementations";
      }
      {
        __unkeyed-1 = "flD";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_definitions()<cr>";
        desc = "[Lsp] Find Definitions";
      }
      {
        __unkeyed-1 = "flt";
        __unkeyed-2 = "<cmd>lua require'telescope.builtin'.lsp_type_definitions()<cr>";
        desc = "[Lsp] Find Type Definitions";
      }
    ];

    typescript-tools.enable = true;
    typescript-tools.settings.code_lens = "references_only";
    typescript-tools.settings.complete_function_calls = true;
    typescript-tools.settings.expose_as_code_action = "all";
    typescript-tools.settings.handlers = {
      "textDocument/publishDiagnostics" =
        # lua
        ''
          require("typescript-tools.api").filter_diagnostics(
            -- Ignore 'This may be converted to an async function' diagnostics.
            { 80006 }
          )
        '';
    };

    crates.enable = true;
    rustaceanvim.enable = true;

    lsp = {
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

        ts_ls.enable = false;
        ts_ls.autostart = false;
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

        hls.enable = false;
        hls.autostart = false;
        hls.installGhc = false;

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

        rust_analyzer.autostart = true;
        rust_analyzer.installCargo = false;
        rust_analyzer.installRustc = false;

        ocamllsp.enable = true;
        ocamllsp.autostart = true;
        ocamllsp.package = pkgs.ocamlPackages.ocaml-lsp;
        ocamllsp.settings.codelens.enable = false;
        ocamllsp.settings.extendedHover.enable = true;
        ocamllsp.settings.duneDiagnostics.enable = false;
        ocamllsp.settings.inlayHints.enable = true;

        nixd.enable = true;
        nixd.autostart = true;
        nixd.settings = {
          nixpkgs.expr = ''import "${inputs.nixpkgs.outPath}" { }'';
          formatting.command = [ "${lib.getExe pkgs.nixfmt}" ];
          diagnostic.suppress = [ "sema-escaping-with" ];
          options =
            let
              flake = ''(builtins.getFlake "github:r17x/universe")'';
            in
            {
              nix-darwin.expr = ''${flake}.darwinConfigurations.eR17x.options'';
              home-manager.expr = ''${flake}.homeConfigurations."r17@eR17x".options'';
              nixvim.expr = ''${flake}.packages.${system}.nvim.options'';
            };
        };

        yamlls.enable = true;
        yamlls.autostart = true;
      };
    };

    lsp-format.enable = true;

    lspkind.enable = true;
    lspkind.symbolMap.Codeium = icons.code;
    lspkind.symbolMap.Copilot = icons.robotFace;
    lspkind.symbolMap.Suggestion = icons.wand;
    lspkind.symbolMap.TabNine = icons.face;
    lspkind.symbolMap.Supermaven = icons.star;
    lspkind.symbolMap.Error = icons.cross4;
    lspkind.symbolMap.Hint = icons.hint;
    lspkind.symbolMap.Info = icons.info2;
    lspkind.symbolMap.Warn = icons.warning2;
    lspkind.symbolMap.DiagnosticSignError = icons.cross4;
    lspkind.symbolMap.DiagnosticSignHint = icons.hint;
    lspkind.symbolMap.DiagnosticSignInfo = icons.info2;
    lspkind.symbolMap.DiagnosticSignWarn = icons.warning2;
    lspkind.cmp.enable = true;
    lspkind.cmp.maxWidth = 24;
    lspkind.cmp.after = # lua
      ''
        function(entry, vim_item, kind)
          local strings = vim.split(kind.kind, "%s", { trimempty = true })
          kind.kind = " " .. (strings[1] or "") .. " "
          kind.menu = "   ⌈" .. (strings[2] or "") .. "⌋"
          return kind
        end
      '';

    lspsaga.enable = true;
    lspsaga.lightbulb.sign = false;
    lspsaga.lightbulb.virtualText = true;
    lspsaga.lightbulb.debounce = 40;
    lspsaga.ui.codeAction = icons.gearSM;

    trouble.enable = true;
    wtf.enable = true;
    nvim-autopairs.enable = true;

    cmp = {
      enable = true;
      autoEnableSources = true;
      settings.sources = [
        { name = "nvim_lsp"; }
        { name = "nvim_lsp_signature_help"; }
        { name = "nvim_lsp_document_symbol"; }
        { name = "luasnip"; }
        { name = "calc"; }
        { name = "yanky"; }
        {
          name = "npm";
          keyword_length = 4;
        }
        {
          name = "emoji";
          trigger_characters = [ ":" ];
        }
        { name = "async_path"; }
      ];
      settings.experimental.ghost_text = true;
      settings.performance.debounce = 60;
      settings.performance.fetching_timeout = 200;
      settings.performance.max_view_entries = 30;
      settings.window.completion.winhighlight = "Normal:Pmenu,FloatBorder:Pmenu,Search:None";
      settings.window.completion.border = "rounded";
      settings.window.documentation.border = "rounded";
      settings.window.completion.col_offset = -3;
      settings.window.completion.side_padding = 0;
      settings.formatting.expandable_indicator = true;
      settings.formatting.fields = [
        "kind"
        "abbr"
        "menu"
      ];
      settings.snippet.expand = # lua
        ''
          function(args) require('luasnip').lsp_expand(args.body) end
        '';
      settings.mapping."<C-e>" = "cmp.mapping.complete()";
      settings.mapping."<C-x>" = "cmp.mapping.close()";
      settings.mapping."<C-f>" = "cmp.mapping.scroll_docs(4)";
      settings.mapping."<S-f>" = "cmp.mapping.scroll_docs(-4)";
      settings.mapping."<CR>" = "cmp.mapping.confirm({ select = true })";
      settings.mapping."<S-Tab>" = "cmp.mapping(cmp.mapping.select_prev_item(), {'i', 's'})";
      settings.mapping."<Tab>" = "cmp.mapping(cmp.mapping.select_next_item(), {'i', 's'})";

      cmdline."/".mapping.__raw = "cmp.mapping.preset.cmdline()";
      cmdline."/".sources = [ { name = "buffer"; } ];
      cmdline."?".mapping.__raw = "cmp.mapping.preset.cmdline()";
      cmdline."?".sources = [ { name = "buffer"; } ];
      cmdline.":".mapping.__raw = "cmp.mapping.preset.cmdline()";
      cmdline.":".sources = [
        { name = "buffer"; }
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
    };
  };
}
