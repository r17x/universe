{
  lib,
  helpers,
  icons,
  pkgs,
  ...
}:

{
  colorscheme = "edge";

  highlight."@neorg.tags.ranged_verbatim.code_block".link = "Fg";

  opts = {
    list = true;
    listchars = "eol:${icons.eol},nbsp:+,tab:${icons.tab} ,trail:-";

    # --- this fold configurations it depends on treesitter
    foldmethod = "expr";
    foldexpr = "v:lua.vim.treesitter.foldexpr()";
    foldcolumn = "0";
    foldtext = "";
    foldlevel = 99;
    foldlevelstart = 1;
    foldnestmax = 4;
  };

  globals = {
    elite_mode = 1;
    # --- colorscheme edge
    edge_style = "neon";
    edge_diagnostic_text_highlight = 1;
    edge_diagnostic_line_highlight = 1;
    edge_diagnostic_virtual_text = "grey";
    edge_dim_foreground = 1;
    edge_dim_inactive_windows = 1;
    edge_float_style = "bright";

    # --- himalaya
    himalaya_executable = "${lib.getExe pkgs.himalaya}";
    himalaya_config_path = "~/.config/himalaya/config.toml";
  };

  extraConfigLuaPre = # lua
    ''
      if vim.fn.has('termguicolors') == 1 then
        vim.opt.termguicolors = true
      end
    '';

  autoCmd = [
    {
      event = [ "User" ];
      pattern = "LspProgressStatusUpdated";
      callback.__raw =
        helpers.mkLuaFun # lua
          ''
            require('lualine').refresh()
          '';
    }
  ];

  extraPlugins = with pkgs.vimPlugins; [
    # theme
    edge
    lackluster
    midnight-nvim

    # extra
    unicode-vim
    lsp-progress-nvim
    pkgs.branches.master.vimPlugins.himalaya-vim

    # TODO: removed branches when inputs.nixpkgs-unstable is updated
    pkgs.branches.master.vimPlugins.nvzone-typr
  ];

  userCommands.StatusLine.desc = "Toggle Status Line";
  userCommands.StatusLine.command.__raw =
    helpers.mkLuaFun
      # lua
      ''
        local toggle = function()
          if vim.g.unhide_lualine == nil then
            vim.g.unhide_lualine = true
          end  
          vim.g.unhide_lualine = not vim.g.unhide_lualine
          return vim.g.unhide_lualine
        end
        require('lualine').hide({ unhide = toggle() })
      '';

  plugins = rec {
    # lazy load management
    lz-n = {
      enable = true;
      plugins = [
        {
          __unkeyed-1 = "unicode.vim";
          cmd = [
            "Digraphs"
            "DigraphsNew"
            "UnicodeNew"
            "UnicodeSearch"
            "UnicodeTable"
            "UnicodeCache"
          ];
        }
        {
          __unkeyed-1 = "nvim-tree.lua";
          cmd = [
            "NvimTreeToggle"
            "NvimTreeOpen"
            "NvimTreeClose"
            "NvimTreeRefresh"
            "NvimTreeFindFile"
          ];
        }
        {
          __unkeyed-1 = "typr";
          cmd = [
            "Typr"
            "TyprStats"
          ];
        }
      ];
    };

    nvim-ufo = {
      enable = true;
      # setupLspCapabilities = true;
      lazyLoad.settings.event = "BufEnter";
      settings = {
        provider_selector = # lua
          ''
            function(bufnr, filetype, buftype)
              local ftMap = {
                vim = "indent",
                python = {"indent"},
                git = "",
                dashboard = "",
                Avante = "",
                AvanteSelectedFiles = "",
                AvanteInput = "",
              }
             return ftMap[filetype]
            end
          '';

        fold_virt_text_handler = # lua
          ''
            function(virtText, lnum, endLnum, width, truncate)
              local newVirtText = {}
              local suffix = ('  %d '):format(endLnum - lnum)
              local sufWidth = vim.fn.strdisplaywidth(suffix)
              local targetWidth = width - sufWidth
              local curWidth = 0
              for _, chunk in ipairs(virtText) do
                local chunkText = chunk[1]
                local chunkWidth = vim.fn.strdisplaywidth(chunkText)
                if targetWidth > curWidth + chunkWidth then
                  table.insert(newVirtText, chunk)
                else
                  chunkText = truncate(chunkText, targetWidth - curWidth)
                  local hlGroup = chunk[2]
                  table.insert(newVirtText, {chunkText, hlGroup})
                  chunkWidth = vim.fn.strdisplaywidth(chunkText)
                  -- str width returned from truncate() may less than 2nd argument, need padding
                  if curWidth + chunkWidth < targetWidth then
                    suffix = suffix .. (' '):rep(targetWidth - curWidth - chunkWidth)
                  end
                  break
                end
                curWidth = curWidth + chunkWidth
              end
              table.insert(newVirtText, {suffix, 'MoreMsg'})
              return newVirtText
            end
          '';
      };
    };

    which-key.settings.spec = [
      {
        __unkeyed-1 = "<c-n>";
        __unkeyed-2 = "<cmd>NvimTreeToggle<CR>";
        desc = "Open Tree in left side";
      }

      {
        __unkeyed-1 = "ts";
        __unkeyed-2 = "<cmd>StatusLine<cr>";
        desc = "Toggle Status Line";
      }

      {
        __unkeyed-1 = "ti";
        __unkeyed-2 = "<cmd>IBLToggle<cr>";
        desc = "Toggle Indent Blankline";
      }

      {
        __unkeyed-1 = "tc";
        __unkeyed-2 = "<cmd>ColorizerToggle<cr>";
        desc = "Toggle Colorizer";
      }
    ];

    wakatime.enable = true;
    wakatime.autoLoad = false;

    image = {
      enable = true;
      integrations.neorg.enabled = true;
      editorOnlyRenderWhenFocused = true;
      tmuxShowOnlyInActiveWindow = true;
    };

    presence-nvim = {
      enable = true;
      enableLineNumber = true;
      autoUpdate = true;
    };

    colorizer = {
      enable = true;
      lazyLoad.settings.cmd = [ "ColorizerToggle" ];
      settings = {
        user_default_options = {
          mode = "virtualtext";
          virtualtext = " ■";
          RRGGBBAA = true;
          RRGGBB = true;
          AARRGGBB = true;
        };
      };
    };

    cursorline.enable = true;

    nvim-tree = {
      enable = true;
      disableNetrw = true;
      view.side = "left";
      view.width = 25;
      respectBufCwd = true;
      autoReloadOnWrite = true;
      git.enable = true;
      filters.dotfiles = true;
      renderer.highlightGit = true;
      renderer.indentMarkers.enable = true;
    };

    rainbow-delimiters = {
      enable = true;
      highlight = indent-blankline.settings.scope.highlight;
    };

    indent-blankline = {
      enable = true;
      settings.indent.char = "";
      settings.scope.enabled = true;
      settings.scope.char = icons.indent;
      settings.scope.highlight = [
        "rainbowcol1"
        "rainbowcol2"
        "rainbowcol3"
        "rainbowcol4"
        "rainbowcol5"
        "rainbowcol6"
        "rainbowcol7"
      ];
      settings.whitespace.highlight = [ "Whitespace" ];
      settings.exclude.buftypes = [
        "nofile"
        "terminal"
        "neorg"
      ];
      settings.exclude.filetypes = [
        "norg"
        "NvimTree"
        "sagaoutline"
        "help"
        "terminal"
        "dashboard"
        "lspinfo"
        "TelescopePrompt"
        "TelescopeResults"
      ];
    };

    smear-cursor = {
      enable = true;
      lazyLoad.enable = true;
      lazyLoad.settings = {
        event = "InsertEnter";
        cmd = "SmearCursorToggle";
        keys = [
          {
            __unkeyed-1 = "<leader>tsc";
            __unkeyed-2 = "<cmd>SmearCursorToggle<cr>";
            desc = "Toggle Animation Cursor";
          }
        ];
      };
    };

    web-devicons = {
      enable = true;
      customIcons = {
        norg = {
          icon = icons.language.org;
          color = "#389EDD";
          cterm_color = "65";
          name = "Norg";
        };
        re = {
          icon = icons.language.reason;
          color = "#DE4B39";
          cterm_color = "65";
          name = "ReasonML";
        };
        dune = {
          icon = icons.language.reason;
          color = "#F5DF36";
          cterm_color = "65";
          name = "Dune";
        };
        "dune-project" = {
          icon = icons.language.reason;
          color = "#F5DF36";
          cterm_color = "65";
          name = "Dune";
        };
      };
    };

    lualine = {
      enable = true;
      lazyLoad.settings.event = "BufEnter";
      lazyLoad.settings.cmd = [ "StatusLine" ];
      lazyLoad.settings.before.__raw = ''
        require('lsp-progress').setup()
      '';
      settings.theme = "edge";
      settings.options.disabled_filetypes.__unkeyed-1 = "NvimTree";
      settings.options.disabled_filetypes.statusline = [
        "sagaoutline"
        "Trouble"
      ];
      settings.options.component_separators.left = "";
      settings.options.component_separators.right = "";
      settings.options.section_separators.left = icons.circleRight;
      settings.options.section_separators.right = icons.circleLeft;
      settings.sections.lualine_a = [
        {
          __unkeyed-1 = "mode";
          separator.right = icons.circleRight;
          padding.left = 1;
        }
      ];
      settings.sections.lualine_b = [
        {
          __unkeyed-1 = "branch";
          color.fg = "BlueSign";
        }
        "diff"
      ];
      settings.sections.lualine_c = [
        "diagnostics"
      ];
      settings.sections.lualine_x = [
        "searchcount"
        "selectioncount"
      ];
      settings.sections.lualine_y = [
        {
          __unkeyed-1.__raw =
            # lua
            ''
              (function()
                local ft = require('lualine.components.filetype'):extend()
                local lsp_progress = require('lsp-progress')

                function ft:update_status()
                  local data = ft.super.update_status(self)
                  return lsp_progress.progress({
                    max_size = 50,
                    format = function(messages)
                        if #messages > 0 then
                            return table.concat(messages, " ")
                        end
                        return data
                    end,
                  })
                end

                return ft
              end)()
            '';
        }
        "progress"
      ];
      settings.sections.lualine_z = [
        {
          __unkeyed-1 = "location";
          separator.left = icons.circleLeft;
          padding.right = 1;
        }
      ];
      settings.winbar = { };
      settings.tabline = { };
      settings.extensions = [ ];
    };

    treesitter = {
      enable = true;
      lazyLoad.enable = true;
      lazyLoad.settings.event = "BufRead";
      folding = true;
      settings.indent.enable = true;
      settings.highlight.enable = true;
      grammarPackages =
        builtins.map
          (
            x:
            pkgs.vimPlugins.nvim-treesitter.builtGrammars.${x} or pkgs.tree-sitter-grammars."tree-sitter-${x}"
          )
          [
            # ┌────────────────────────────────────┐
            # │ move to ignoreInstall for disabled │
            # └────────────────────────────────────┘
            "asm"
            "bash"
            "c"
            "cmake"
            "comment"
            "css"
            "dhall"
            "diff"
            "dockerfile"
            "dot"
            "fish"
            "git_config"
            "git_rebase"
            "gitattributes"
            "gitcommit"
            "gitignore"
            "go"
            "gomod"
            "gosum"
            "gotmpl"
            "gpg"
            "graphql"
            "haskell"
            "haskell_persistent"
            "hcl"
            "helm"
            "html"
            "http"
            "javascript"
            "jq"
            "jsdoc"
            "json"
            "latex"
            "lua"
            "luadoc"
            "luap"
            "luau"
            "make"
            "markdown"
            "markdown_inline"
            "mermaid"
            "nix"
            "norg"
            "norg-meta"
            "ocaml"
            "ocaml_interface"
            "ocamllex"
            "passwd"
            "po"
            "proto"
            "pymanifest"
            "python"
            "query"
            "regex"
            "rust"
            "rescript"
            "sql"
            "ssh_config"
            "templ"
            "terraform"
            "textproto"
            "tmux"
            "todotxt"
            "toml"
            "tsx"
            "typescript"
            "vhs"
            "vim"
            "vimdoc"
            "xml"
            "yaml"
          ];
    };
  };
}
