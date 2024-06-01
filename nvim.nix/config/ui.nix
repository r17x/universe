{ pkgs, ... }:
{
  highlight."@neorg.tags.ranged_verbatim.code_block".link = "Fg";
  extraPlugins = with pkgs.vimPlugins; [ edge unicode-vim lualine-lsp-progress vim-wakatime ];

  plugins.which-key.registrations = {
    "<c-n>" = [ "<cmd>NvimTreeToggle<CR>" "Open Tree in left side" ];
    "<leader>tl" = [ "<cmd>lua vim.g.unhide_lualine = not vim.g.unhide_lualine; require('lualine').hide({ unhide = vim.g.unhide_lualine })<cr>" "Toggle Status Line" ];
    "<leader>tib" = [ "<cmd>IBLToggle<cr>" "Toggle Indent Blankline" ];
    "<leader>tc" = [ "<cmd>ColorizerToggle<cr>" "Toggle Colorizer" ];
    "fhi" = [ "<cmd>Telescope highlights<cr>" "Find Highlight Groups" ];
  };

  plugins.image.enable = true;
  plugins.image.integrations.neorg.enabled = true;
  plugins.image.editorOnlyRenderWhenFocused = true;
  plugins.image.tmuxShowOnlyInActiveWindow = true;

  plugins.presence-nvim.enable = true;
  plugins.presence-nvim.enableLineNumber = true;
  plugins.presence-nvim.autoUpdate = true;

  plugins.nvim-colorizer.enable = true;
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

  plugins.indent-blankline.enable = true;
  plugins.indent-blankline.settings.indent.char = "┊";
  plugins.indent-blankline.settings.exclude.buftypes = [ "terminal" "neorg" ];
  plugins.indent-blankline.settings.exclude.filetypes = [
    "NvimTree"
    "sagaoutline"
    "help"
    "terminal"
    "dashboard"
    "lspinfo"
    "TelescopePrompt"
    "TelescopeResults"
  ];
  extraConfigLua = ''
    -- enable elite mode
    vim.g.elite_mode = 1

    vim.opt.list = true
    vim.opt.listchars:append("eol:↴")

    -- treesitter folding
    vim.cmd [[ set nofoldenable ]]
  '';

  colorscheme = "edge";
  extraConfigLuaPre = ''
        vim.cmd [[ 
          if has('termguicolors') 
    	      set guicursor+=n:hor20-Cursor/lCursor
            set termguicolors 
          endif 
        ]]

        vim.g.edge_style = "neon"
        vim.g.edge_diagnostic_text_highlight = 1
        vim.g.edge_diagnostic_line_highlight = 1
        vim.g.edge_diagnostic_virtual_text = "grey"
        vim.g.edge_dim_foreground = 1
        vim.g.edge_dim_inactive_windows = 1
        vim.g.edge_float_style = "bright"

        -- TODO: fix directory creation in Nix befor enable edge_better_performance
        -- let g:edge_better_performance = 1
  '';

  # based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/lualine.lua}

  plugins.lualine.enable = true;
  plugins.lualine.disabledFiletypes.statusline = [ "sagaoutline" "NvimTree" "Trouble" ];
  plugins.lualine.theme = "edge";
  plugins.lualine.componentSeparators.left = "";
  plugins.lualine.componentSeparators.right = "";
  plugins.lualine.sectionSeparators.left = "";
  plugins.lualine.sectionSeparators.right = "";
  plugins.lualine.sections.lualine_a = [
    {
      name = "mode";
      separator.right = "";
      extraConfig.padding.left = 1;
    }
  ];

  plugins.lualine.sections.lualine_b = [
    {
      name = "branch";
      color.fg = "BlueSign";
    }
    # {
    #   name = "filename";
    #   extraConfig.symbols = {
    #     modified = "♼";
    #     readonly = "⏿";
    #     unnamed = "⍬";
    #     newfile = "⊕";
    #   };
    # }
    # "filesize"
  ];
  plugins.lualine.sections.lualine_c = [ "diff" "diagnostics" ];
  plugins.lualine.sections.lualine_x = [
    {
      name = "lsp_progress";
      extraConfig.colors.title = "Cyan";
      extraConfig.separators.component = "";
      extraConfig.separators.percentage.pre = "";
      extraConfig.separators.percentage.post = "%% ";
      extraConfig.separators.title.pre = "";
      extraConfig.separators.title.post = ": ";
      extraConfig.displayComponents = [
        "spinner"
        "lsp_client_name"
        # [ "title" "percentage" "message" ]
        # asdfadf
      ];
      extraConfig.timer.progressEnddelay = 500;
      extraConfig.timer.spinner = 1000;
      extraConfig.timer.lspClientNameEnddelay = 1000;
      extraConfig.spinnerSymbols = [ "⣀" "⣠" "⣴" "⣶" "⣾" "⣿" "⢿" "⡿" ];
    }
  ];
  plugins.lualine.sections.lualine_y = [ "searchcount" "selectioncount" "filetype" "progress" ];
  plugins.lualine.sections.lualine_z = [
    {
      name = "location";
      separator.left = "";
      extraConfig.padding.right = 1;
    }
  ];
  plugins.lualine.winbar = { };
  plugins.lualine.tabline = { };
  plugins.lualine.extensions = [ ];

  plugins.treesitter.enable = true;
  plugins.treesitter.folding = true;
  plugins.treesitter.indent = true;
  plugins.treesitter.nixvimInjections = true;
  # plugins.treesitter.grammarPackages = pkgs.vimPlugins.nvim-treesitter.passthru.allGrammars ++ [ pkgs.tree-sitter-rescript ];
  plugins.treesitter.ignoreInstall = [
    # ┌─────────────────────────────────────┐
    # │ move to ensureInstalled for enabled │
    # └─────────────────────────────────────┘
    "ada"
    "agda"
    "angular"
    "apex"
    "arduino"
    "astro"
    "authzed"
    "awk"
    "bass"
    "beancount"
    "bibtex"
    "bicep"
    "bitbake"
    "blueprint"
    "c_sharp"
    "cairo"
    "capnp"
    "chatito"
    "clojure"
    "commonlisp"
    "cooklang"
    "corn"
    "cpon"
    "cpp"
    "csv"
    "cuda"
    "cue"
    "d"
    "dart"
    "devicetree"
    "disassembly"
    "djot"
    "doxygen"
    "dtd"
    "earthfile"
    "ebnf"
    "eds"
    "eex"
    "elixir"
    "elm"
    "elsa"
    "elvish"
    "embedded_template"
    "erlang"
    "facility"
    "faust"
    "fennel"
    "fidl"
    "firrtl"
    "foam"
    "forth"
    "fortran"
    "fsh"
    "func"
    "fusion"
    "gdscript"
    "gdshader"
    "gleam"
    "glimmer"
    "glsl"
    "gn"
    "gnuplot"
    "godot_resource"
    "gowork"
    "groovy"
    "gstlaunch"
    "hack"
    "hare"
    "heex"
    "hjson"
    "hlsl"
    "hlsplaylist"
    "hocon"
    "hoon"
    "htmldjango"
    "hurl"
    "hyprlang"
    "idl"
    "ini"
    "inko"
    "ispc"
    "janet_simple"
    "java"
    "json5"
    "jsonc"
    "jsonnet"
    "julia"
    "just"
    "kconfig"
    "kdl"
    "kotlin"
    "koto"
    "kusto"
    "lalrpop"
    "ledger"
    "leo"
    "linkerscript"
    "liquid"
    "liquidsoap"
    "llvm"
    "m68k"
    "matlab"
    "menhir"
    "meson"
    "mlir"
    "muttrc"
    "nasm"
    "nickel"
    "nim"
    "nim_format_string"
    "ninja"
    "nqc"
    "objc"
    "objdump"
    "odin"
    "org"
    "pascal"
    "pem"
    "perl"
    "php"
    "php_only"
    "phpdoc"
    "pioasm"
    "pod"
    "poe_filter"
    "pony"
    "printf"
    "prisma"
    "promql"
    "properties"
    "prql"
    "psv"
    "pug"
    "puppet"
    "purescript"
    "ql"
    "qmldir"
    "qmljs"
    "r"
    "racket"
    "rasi"
    "rbs"
    "re2c"
    "readline"
    "rego"
    "requirements"
    "rnoweb"
    "robot"
    "roc"
    "ron"
    "rst"
    "ruby"
    "scala"
    "scfg"
    "scheme"
    "scss"
    "slang"
    "slint"
    "smali"
    "smithy"
    "snakemake"
    "solidity"
    "soql"
    "sosl"
    "sourcepawn"
    "sparql"
    "squirrel"
    "starlark"
    "strace"
    "styled"
    "supercollider"
    "surface"
    "svelte"
    "swift"
    "sxhkdrc"
    "systemtap"
    "t32"
    "tablegen"
    "tact"
    "tcl"
    "teal"
    "thrift"
    "tiger"
    "tlaplus"
    "tsv"
    "turtle"
    "twig"
    "typespec"
    "typoscript"
    "typst"
    "udev"
    "ungrammar"
    "unison"
    "usd"
    "uxntal"
    "v"
    "vala"
    "vento"
    "verilog"
    "vue"
    "wgsl"
    "wgsl_bevy"
    "wing"
    "wit"
    "xcompose"
    "yang"
    "yuck"
    "zathurarc"
    "zig"
  ];
  plugins.treesitter.ensureInstalled = [
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
    "norg_meta"
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

  plugins.rainbow-delimiters.enable = true;
  plugins.rainbow-delimiters.highlight = [
    "RainbowLevel1"
    "RainbowLevel2"
    "RainbowLevel3"
    "RainbowLevel4"
    "RainbowLevel5"
    "RainbowLevel6"
    "RainbowLevel7"
    "RainbowLevel0"
  ];
}
