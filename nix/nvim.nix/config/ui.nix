{
  helpers,
  icons,
  pkgs,
  ...
}:
let
  indentBlankLineHighlights = [
    "rainbowcol1"
    "rainbowcol2"
    "rainbowcol3"
    "rainbowcol4"
    "rainbowcol5"
    "rainbowcol6"
    "rainbowcol7"
  ];
  devicons = {
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

in
{
  highlight."@neorg.tags.ranged_verbatim.code_block".link = "Fg";

  extraPlugins = with pkgs.vimPlugins; [
    # theme
    edge
    lackluster
    midnight-nvim

    # extra
    unicode-vim
    lsp-progress-nvim

    # TODO: removed branches when inputs.nixpkgs-unstable is updated
    pkgs.branches.master.vimPlugins.nvzone-typr
  ];

  plugins.lz-n.plugins = [
    {
      __unkeyed-1 = "typr";
      cmd = [
        "Typr"
        "TyprStats"
      ];
    }
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

  plugins.which-key.settings.spec = [

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

  plugins.wakatime.enable = true;

  plugins.image.enable = true;
  plugins.image.integrations.neorg.enabled = true;
  plugins.image.editorOnlyRenderWhenFocused = true;
  plugins.image.tmuxShowOnlyInActiveWindow = true;

  plugins.presence-nvim.enable = true;
  plugins.presence-nvim.enableLineNumber = true;
  plugins.presence-nvim.autoUpdate = true;

  plugins.colorizer = {
    enable = true;
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

  plugins.cursorline.enable = true;

  # based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/nvim-tree.lua}
  plugins.nvim-tree.enable = true;
  plugins.nvim-tree.disableNetrw = true;
  plugins.nvim-tree.view.side = "left";
  plugins.nvim-tree.view.width = 25;
  plugins.nvim-tree.respectBufCwd = true;
  plugins.nvim-tree.autoReloadOnWrite = true;
  plugins.nvim-tree.git.enable = true;
  plugins.nvim-tree.filters.dotfiles = true;
  plugins.nvim-tree.renderer.highlightGit = true;
  plugins.nvim-tree.renderer.indentMarkers.enable = true;

  plugins.rainbow-delimiters.enable = true;
  plugins.rainbow-delimiters.highlight = indentBlankLineHighlights;

  plugins.indent-blankline.enable = true;
  plugins.indent-blankline.settings.indent.char = "";
  plugins.indent-blankline.luaConfig.post = # lua
    ''
      local hooks = require "ibl.hooks"
      hooks.register(hooks.type.SCOPE_HIGHLIGHT, hooks.builtin.scope_highlight_from_extmark)
    '';
  plugins.indent-blankline.settings.scope.enabled = true;
  plugins.indent-blankline.settings.scope.char = icons.indent;
  plugins.indent-blankline.settings.scope.highlight = indentBlankLineHighlights;
  plugins.indent-blankline.settings.whitespace.highlight = [ "Whitespace" ];
  plugins.indent-blankline.settings.exclude.buftypes = [
    "nofile"
    "terminal"
    "neorg"
  ];
  plugins.indent-blankline.settings.exclude.filetypes = [
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
  extraConfigLua = # lua
    ''
      -- enable elite mode
      vim.g.elite_mode = 1

      vim.opt.list = true

      -- listchars=eol:↴,nbsp:+,tab:> ,trail:-
      vim.opt.listchars = "eol:${icons.eol},nbsp:+,tab:${icons.tab} ,trail:-"

      -- treesitter folding
      vim.cmd [[ set nofoldenable ]]
    '';

  colorscheme = "edge";

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

  plugins.lz-n.enable = true;
  plugins.smear-cursor = {
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

  extraConfigLuaPre = # lua
    ''
      if vim.fn.has('termguicolors') == 1 then
        vim.opt.termguicolors = true
      end

      vim.g.edge_style = "neon"
      vim.g.edge_diagnostic_text_highlight = 1
      vim.g.edge_diagnostic_line_highlight = 1
      vim.g.edge_diagnostic_virtual_text = "grey"
      vim.g.edge_dim_foreground = 1
      vim.g.edge_dim_inactive_windows = 1
      vim.g.edge_float_style = "bright"

      local lsp_progress = require('lsp-progress')
      lsp_progress.setup()
    '';

  plugins.web-devicons.enable = true;
  plugins.web-devicons.customIcons = devicons;

  # based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/lualine.lua}
  plugins.lualine.enable = true;
  plugins.lualine.settings.theme = "edge";
  plugins.lualine.settings.options.disabled_filetypes.__unkeyed-1 = "NvimTree";
  plugins.lualine.settings.options.disabled_filetypes.statusline = [
    "sagaoutline"
    "Trouble"
  ];
  plugins.lualine.settings.options.component_separators.left = "";
  plugins.lualine.settings.options.component_separators.right = "";
  plugins.lualine.settings.options.section_separators.left = icons.circleRight;
  plugins.lualine.settings.options.section_separators.right = icons.circleLeft;
  plugins.lualine.settings.sections.lualine_a = [
    {
      __unkeyed-1 = "mode";
      separator.right = icons.circleRight;
      padding.left = 1;
    }
  ];
  plugins.lualine.settings.sections.lualine_b = [
    {
      __unkeyed-1 = "branch";
      color.fg = "BlueSign";
    }
    "diff"
  ];
  plugins.lualine.settings.sections.lualine_c = [
    "diagnostics"
  ];
  plugins.lualine.settings.sections.lualine_x = [
    "searchcount"
    "selectioncount"
  ];
  plugins.lualine.settings.sections.lualine_y = [
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
                    -- @TODO: add active clients 
                    -- local active_clients = vim.lsp.buf_get_clients()
                    -- local client_names = {}
                    -- for _, client in ipairs(active_clients) do
                    --     if client and client.name ~= "" then
                    --         table.insert(client_names, 1, client.name)
                    --     end
                    -- end
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
  plugins.lualine.settings.sections.lualine_z = [
    {
      __unkeyed-1 = "location";
      separator.left = icons.circleLeft;
      padding.right = 1;
    }
  ];
  plugins.lualine.settings.winbar = { };
  plugins.lualine.settings.tabline = { };
  plugins.lualine.settings.extensions = [ ];

  plugins.treesitter.enable = true;
  plugins.treesitter.folding = true;
  plugins.treesitter.settings.indent.enable = true;
  plugins.treesitter.settings.highlight.enable = true;
  #plugins.treesitter.nixvimInjections = true;
  #plugins.treesitter.nixGrammars = true;
  plugins.treesitter.grammarPackages =
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

  # plugins.treesitter.settings.ignore_install = [
  #   # ┌─────────────────────────────────────┐
  #   # │ move to ensureInstalled for enabled │
  #   # └─────────────────────────────────────┘
  #   "ada"
  #   "agda"
  #   "angular"
  #   "apex"
  #   "arduino"
  #   "astro"
  #   "authzed"
  #   "awk"
  #   "bass"
  #   "beancount"
  #   "bibtex"
  #   "bicep"
  #   "bitbake"
  #   "blueprint"
  #   "c_sharp"
  #   "cairo"
  #   "capnp"
  #   "chatito"
  #   "clojure"
  #   "commonlisp"
  #   "cooklang"
  #   "corn"
  #   "cpon"
  #   "cpp"
  #   "csv"
  #   "cuda"
  #   "cue"
  #   "d"
  #   "dart"
  #   "devicetree"
  #   "disassembly"
  #   "djot"
  #   "doxygen"
  #   "dtd"
  #   "earthfile"
  #   "ebnf"
  #   "eds"
  #   "eex"
  #   "elixir"
  #   "elm"
  #   "elsa"
  #   "elvish"
  #   "embedded_template"
  #   "erlang"
  #   "facility"
  #   "faust"
  #   "fennel"
  #   "fidl"
  #   "firrtl"
  #   "foam"
  #   "forth"
  #   "fortran"
  #   "fsh"
  #   "func"
  #   "fusion"
  #   "gdscript"
  #   "gdshader"
  #   "gleam"
  #   "glimmer"
  #   "glsl"
  #   "gn"
  #   "gnuplot"
  #   "godot_resource"
  #   "gowork"
  #   "groovy"
  #   "gstlaunch"
  #   "hack"
  #   "hare"
  #   "heex"
  #   "hjson"
  #   "hlsl"
  #   "hlsplaylist"
  #   "hocon"
  #   "hoon"
  #   "htmldjango"
  #   "hurl"
  #   "hyprlang"
  #   "idl"
  #   "ini"
  #   "inko"
  #   "ispc"
  #   "janet_simple"
  #   "java"
  #   "json5"
  #   "jsonc"
  #   "jsonnet"
  #   "julia"
  #   "just"
  #   "kconfig"
  #   "kdl"
  #   "kotlin"
  #   "koto"
  #   "kusto"
  #   "lalrpop"
  #   "ledger"
  #   "leo"
  #   "linkerscript"
  #   "liquid"
  #   "liquidsoap"
  #   "llvm"
  #   "m68k"
  #   "matlab"
  #   "menhir"
  #   "meson"
  #   "mlir"
  #   "muttrc"
  #   "nasm"
  #   "nickel"
  #   "nim"
  #   "nim_format_string"
  #   "ninja"
  #   "nqc"
  #   "objc"
  #   "objdump"
  #   "odin"
  #   "org"
  #   "pascal"
  #   "pem"
  #   "perl"
  #   "php"
  #   "php_only"
  #   "phpdoc"
  #   "pioasm"
  #   "pod"
  #   "poe_filter"
  #   "pony"
  #   "printf"
  #   "prisma"
  #   "promql"
  #   "properties"
  #   "prql"
  #   "psv"
  #   "pug"
  #   "puppet"
  #   "purescript"
  #   "ql"
  #   "qmldir"
  #   "qmljs"
  #   "r"
  #   "racket"
  #   "rasi"
  #   "rbs"
  #   "re2c"
  #   "readline"
  #   "rego"
  #   "requirements"
  #   "rnoweb"
  #   "robot"
  #   "roc"
  #   "ron"
  #   "rst"
  #   "ruby"
  #   "scala"
  #   "scfg"
  #   "scheme"
  #   "scss"
  #   "slang"
  #   "slint"
  #   "smali"
  #   "smithy"
  #   "snakemake"
  #   "solidity"
  #   "soql"
  #   "sosl"
  #   "sourcepawn"
  #   "sparql"
  #   "squirrel"
  #   "starlark"
  #   "strace"
  #   "styled"
  #   "supercollider"
  #   "surface"
  #   "svelte"
  #   "swift"
  #   "sxhkdrc"
  #   "systemtap"
  #   "t32"
  #   "tablegen"
  #   "tact"
  #   "tcl"
  #   "teal"
  #   "thrift"
  #   "tiger"
  #   "tlaplus"
  #   "tsv"
  #   "turtle"
  #   "twig"
  #   "typespec"
  #   "typoscript"
  #   "typst"
  #   "udev"
  #   "ungrammar"
  #   "unison"
  #   "usd"
  #   "uxntal"
  #   "v"
  #   "vala"
  #   "vento"
  #   "verilog"
  #   "vue"
  #   "wgsl"
  #   "wgsl_bevy"
  #   "wing"
  #   "wit"
  #   "xcompose"
  #   "yang"
  #   "yuck"
  #   "zathurarc"
  #   "zig"
  # ];
}
