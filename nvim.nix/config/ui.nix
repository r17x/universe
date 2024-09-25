{ lib, helpers, config, icons, pkgs, ... }:
let
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

  deviconsToLuaString = icons:
    builtins.foldl' (acc: icon: ''
      ${acc}
      devicons.set_icon ${icon}
    '') "local devicons = require'nvim-web-devicons'"
    (lib.attrsets.mapAttrsToList
      (name: value: helpers.toLuaObject { "${name}" = value; }) icons);

in {
  highlight."@neorg.tags.ranged_verbatim.code_block".link = "Fg";

  extraPlugins = with pkgs.vimPlugins; [
    edge
    unicode-vim
    lualine-lsp-progress
  ];

  plugins.which-key.settings.spec = [
    {
      __unkeyed-1 = "<c-n>";
      __unkeyed-2 = "<cmd>NvimTreeToggle<CR>";
      desc = icons.withIcon "git" "Open Tree in left side";
    }
    {
      __unkeyed-1 = "<leader>tl";
      __unkeyed-2 =
        "<cmd>lua vim.g.unhide_lualine = not vim.g.unhide_lualine; require('lualine').hide({ unhide = vim.g.unhide_lualine })<cr>";
      desc = icons.withIcon "git" "Toggle Status Line";
    }
    {
      __unkeyed-1 = "<leader>tib";
      __unkeyed-2 = "<cmd>IBLToggle<cr>";
      desc = icons.withIcon "git" "Toggle Indent Blankline";
    }
    {
      __unkeyed-1 = "<leader>tc";
      __unkeyed-2 = "<cmd>ColorizerToggle<cr>";
      desc = icons.withIcon "git" "Toggle Colorizer";
    }
    {
      __unkeyed-1 = "fhi";
      __unkeyed-2 = "<cmd>Telescope highlights<cr>";
      desc = icons.withIcon "git" "Find Highlight Groups";
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

  plugins.nvim-colorizer = {
    enable = true;
    userDefaultOptions = {
      mode = "virtualtext";
      virtualtext = " ■";
      RRGGBBAA = true;
      RRGGBB = true;
      AARRGGBB = true;
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

  plugins.indent-blankline.settings.indent.enable = true;
  plugins.indent-blankline.settings.indent.char = icons.indent;
  plugins.indent-blankline.settings.exclude.buftypes = [ "terminal" "neorg" ];
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
      vim.opt.listchars:append("eol:↴")

      -- treesitter folding
      vim.cmd [[ set nofoldenable ]]

      -- devicons
      ${deviconsToLuaString devicons}
    '';

  colorscheme = "edge";
  extraConfigLuaPre = # lua
    ''
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

  plugins.web-devicons.enable = true;

  # based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/lualine.lua}
  plugins.lualine.enable = true;
  plugins.lualine.settings.disabled_filetypes.statusline =
    [ "sagaoutline" "NvimTree" "Trouble" ];
  plugins.lualine.settings.theme = "edge";
  plugins.lualine.settings.components_separatos.left = "";
  plugins.lualine.settings.components_separatos.right = "";
  plugins.lualine.settings.secction_separators.left = icons.circleRight;
  plugins.lualine.settings.secction_separators.right = icons.circleLeft;
  plugins.lualine.settings.sections.lualine_a = [{
    __unkeyed-1 = "mode";
    separator.right = icons.circleRight;
    padding.left = 1;
  }];
  plugins.lualine.settings.sections.lualine_b = [{
    __unkeyed-1 = "branch";
    color.fg = "BlueSign";
  }];
  plugins.lualine.settings.sections.lualine_c = [ "diff" "diagnostics" ];
  plugins.lualine.settings.sections.lualine_x = [{
    __unkeyed-1 = "lsp_progress";
    colors.title = "Cyan";
    separators.component = "";
    separators.percentage.pre = "";
    separators.percentage.post = "%% ";
    separators.title.pre = "";
    separators.title.post = ": ";
    displayComponents = [ "spinner" "lsp_client_name" ];
    timer.progressEnddelay = 500;
    timer.spinner = 1000;
    timer.lspClientNameEnddelay = 1000;
    spinnerSymbols = [ "⣀" "⣠" "⣴" "⣶" "⣾" "⣿" "⢿" "⡿" ];
  }];
  plugins.lualine.settings.sections.lualine_y =
    [ "searchcount" "selectioncount" "filetype" "progress" ];
  plugins.lualine.settings.sections.lualine_z = [{
    __unkeyed-1 = "location";
    separator.left = icons.circleLeft;
    padding.right = 1;
  }];
  plugins.lualine.settings.winbar = { };
  plugins.lualine.settings.tabline = { };
  plugins.lualine.settings.extensions = [ ];

  plugins.treesitter.enable = true;
  plugins.treesitter.folding = true;
  plugins.treesitter.settings.indent.enable = true;
  plugins.treesitter.nixvimInjections = true;
  plugins.treesitter.grammarPackages =
    builtins.map (x: pkgs.vimPlugins.nvim-treesitter.builtGrammars.${x})
    config.plugins.treesitter.settings.ensure_installed;
  plugins.treesitter.settings.ignore_install = [
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
  plugins.treesitter.settings.ensure_installed = [
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
    # "rescript"
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
