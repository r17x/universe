{
  lib,
  vimUtils,
  writeText,
  runCommand,
  ...
}:

let
  colors = import ../../colors.nix { inherit lib; };

  # Generate a Lua colorscheme file from a Base16 palette list
  mkColorscheme =
    name: palette:
    let
      s = colors.toScheme palette;
    in
    writeText "${name}.lua" ''
      -- Auto-generated from colors.nix — ${name}
      vim.cmd("hi clear")
      if vim.fn.exists("syntax_on") then vim.cmd("syntax reset") end
      vim.o.termguicolors = true
      vim.g.colors_name = "${name}"
      vim.o.background = "dark"

      local c = {
        bg        = "${s.base00}",
        red       = "${s.base01}",
        green     = "${s.base02}",
        yellow    = "${s.base03}",
        blue      = "${s.base04}",
        magenta   = "${s.base05}",
        cyan      = "${s.base06}",
        fg        = "${s.base07}",
        bright_bg = "${s.base08}",
        bright_red = "${s.base09}",
        muted     = "${s.base0A}",
        surface   = "${s.base0B}",
        light_blue = "${s.base0C}",
        light_magenta = "${s.base0D}",
        light_cyan = "${s.base0E}",
        light_bg  = "${s.base0F}",
      }

      local hi = function(group, opts)
        vim.api.nvim_set_hl(0, group, opts)
      end

      -- Editor
      hi("Normal",       { fg = c.fg, bg = c.bg })
      hi("NormalFloat",  { fg = c.fg, bg = c.bright_bg })
      hi("FloatBorder",  { fg = c.muted, bg = c.bright_bg })
      hi("ColorColumn",  { bg = c.bright_bg })
      hi("Cursor",       { fg = c.bg, bg = c.fg })
      hi("CursorLine",   { bg = c.bright_bg })
      hi("CursorLineNr", { fg = c.yellow, bold = true })
      hi("LineNr",       { fg = c.muted })
      hi("SignColumn",   { bg = c.bg })
      hi("VertSplit",    { fg = c.surface })
      hi("WinSeparator", { fg = c.surface })
      hi("StatusLine",   { fg = c.fg, bg = c.bright_bg })
      hi("StatusLineNC", { fg = c.muted, bg = c.bright_bg })
      hi("Pmenu",        { fg = c.fg, bg = c.bright_bg })
      hi("PmenuSel",     { fg = c.bg, bg = c.blue })
      hi("PmenuSbar",    { bg = c.surface })
      hi("PmenuThumb",   { bg = c.muted })
      hi("TabLine",      { fg = c.muted, bg = c.bright_bg })
      hi("TabLineFill",  { bg = c.bg })
      hi("TabLineSel",   { fg = c.fg, bg = c.bg, bold = true })
      hi("Visual",       { bg = c.surface })
      hi("VisualNOS",    { bg = c.surface })
      hi("Search",       { fg = c.bg, bg = c.yellow })
      hi("IncSearch",    { fg = c.bg, bg = c.yellow, bold = true })
      hi("CurSearch",    { fg = c.bg, bg = c.yellow, bold = true })
      hi("MatchParen",   { fg = c.yellow, bold = true, underline = true })
      hi("Folded",       { fg = c.muted, bg = c.bright_bg })
      hi("FoldColumn",   { fg = c.muted, bg = c.bg })
      hi("NonText",      { fg = c.surface })
      hi("SpecialKey",   { fg = c.surface })
      hi("Whitespace",   { fg = c.surface })
      hi("EndOfBuffer",  { fg = c.bg })
      hi("WildMenu",     { fg = c.bg, bg = c.blue })
      hi("Directory",    { fg = c.blue })
      hi("Title",        { fg = c.magenta, bold = true })
      hi("ErrorMsg",     { fg = c.red, bold = true })
      hi("WarningMsg",   { fg = c.yellow })
      hi("ModeMsg",      { fg = c.fg, bold = true })
      hi("MoreMsg",      { fg = c.green })
      hi("Question",     { fg = c.green })
      hi("Conceal",      { fg = c.muted })
      hi("SpellBad",     { undercurl = true, sp = c.red })
      hi("SpellCap",     { undercurl = true, sp = c.yellow })
      hi("SpellLocal",   { undercurl = true, sp = c.cyan })
      hi("SpellRare",    { undercurl = true, sp = c.magenta })

      -- Syntax
      hi("Comment",      { fg = c.muted, italic = true })
      hi("Constant",     { fg = c.yellow })
      hi("String",       { fg = c.green })
      hi("Character",    { fg = c.green })
      hi("Number",       { fg = c.yellow })
      hi("Boolean",      { fg = c.yellow })
      hi("Float",        { fg = c.yellow })
      hi("Identifier",   { fg = c.fg })
      hi("Function",     { fg = c.blue })
      hi("Statement",    { fg = c.magenta })
      hi("Conditional",  { fg = c.magenta })
      hi("Repeat",       { fg = c.magenta })
      hi("Label",        { fg = c.magenta })
      hi("Operator",     { fg = c.cyan })
      hi("Keyword",      { fg = c.magenta })
      hi("Exception",    { fg = c.red })
      hi("PreProc",      { fg = c.cyan })
      hi("Include",      { fg = c.cyan })
      hi("Define",       { fg = c.magenta })
      hi("Macro",        { fg = c.magenta })
      hi("PreCondit",    { fg = c.cyan })
      hi("Type",         { fg = c.cyan })
      hi("StorageClass", { fg = c.magenta })
      hi("Structure",    { fg = c.cyan })
      hi("Typedef",      { fg = c.cyan })
      hi("Special",      { fg = c.light_blue })
      hi("SpecialChar",  { fg = c.light_blue })
      hi("Tag",          { fg = c.blue })
      hi("Delimiter",    { fg = c.fg })
      hi("Debug",        { fg = c.red })
      hi("Underlined",   { underline = true })
      hi("Error",        { fg = c.red })
      hi("Todo",         { fg = c.yellow, bg = c.bright_bg, bold = true })

      -- Diff
      hi("DiffAdd",      { fg = c.green, bg = c.bg })
      hi("DiffChange",   { fg = c.yellow, bg = c.bg })
      hi("DiffDelete",   { fg = c.red, bg = c.bg })
      hi("DiffText",     { fg = c.blue, bg = c.bright_bg })

      -- Diagnostics
      hi("DiagnosticError",      { fg = c.red })
      hi("DiagnosticWarn",       { fg = c.yellow })
      hi("DiagnosticInfo",       { fg = c.blue })
      hi("DiagnosticHint",       { fg = c.cyan })
      hi("DiagnosticUnderlineError", { undercurl = true, sp = c.red })
      hi("DiagnosticUnderlineWarn",  { undercurl = true, sp = c.yellow })
      hi("DiagnosticUnderlineInfo",  { undercurl = true, sp = c.blue })
      hi("DiagnosticUnderlineHint",  { undercurl = true, sp = c.cyan })

      -- Git signs
      hi("GitSignsAdd",    { fg = c.green })
      hi("GitSignsChange", { fg = c.yellow })
      hi("GitSignsDelete", { fg = c.red })

      -- Treesitter
      hi("@variable",          { fg = c.fg })
      hi("@variable.builtin",  { fg = c.red })
      hi("@constant",          { fg = c.yellow })
      hi("@constant.builtin",  { fg = c.yellow })
      hi("@function",          { fg = c.blue })
      hi("@function.builtin",  { fg = c.light_blue })
      hi("@function.call",     { fg = c.blue })
      hi("@method",            { fg = c.blue })
      hi("@method.call",       { fg = c.blue })
      hi("@keyword",           { fg = c.magenta })
      hi("@keyword.function",  { fg = c.magenta })
      hi("@keyword.return",    { fg = c.magenta })
      hi("@keyword.operator",  { fg = c.cyan })
      hi("@string",            { fg = c.green })
      hi("@string.escape",     { fg = c.light_blue })
      hi("@string.regex",      { fg = c.light_blue })
      hi("@number",            { fg = c.yellow })
      hi("@boolean",           { fg = c.yellow })
      hi("@type",              { fg = c.cyan })
      hi("@type.builtin",      { fg = c.cyan })
      hi("@property",          { fg = c.light_blue })
      hi("@field",             { fg = c.light_blue })
      hi("@parameter",         { fg = c.fg })
      hi("@operator",          { fg = c.cyan })
      hi("@punctuation",       { fg = c.muted })
      hi("@punctuation.bracket", { fg = c.fg })
      hi("@punctuation.delimiter", { fg = c.muted })
      hi("@comment",           { fg = c.muted, italic = true })
      hi("@tag",               { fg = c.blue })
      hi("@tag.attribute",     { fg = c.cyan })
      hi("@tag.delimiter",     { fg = c.muted })

      -- LSP semantic tokens
      hi("@lsp.type.function",  { fg = c.blue })
      hi("@lsp.type.method",    { fg = c.blue })
      hi("@lsp.type.property",  { fg = c.light_blue })
      hi("@lsp.type.variable",  { fg = c.fg })
      hi("@lsp.type.parameter", { fg = c.fg })
      hi("@lsp.type.namespace", { fg = c.cyan })
      hi("@lsp.type.type",      { fg = c.cyan })
      hi("@lsp.type.enum",      { fg = c.cyan })
      hi("@lsp.type.keyword",   { fg = c.magenta })

      -- Telescope
      hi("TelescopeNormal",       { fg = c.fg, bg = c.bg })
      hi("TelescopeBorder",       { fg = c.surface })
      hi("TelescopePromptBorder", { fg = c.muted })
      hi("TelescopeResultsBorder",{ fg = c.surface })
      hi("TelescopePreviewBorder",{ fg = c.surface })
      hi("TelescopeSelection",    { bg = c.bright_bg })
      hi("TelescopeMatching",     { fg = c.yellow, bold = true })

      -- NvimTree
      hi("NvimTreeNormal",       { fg = c.fg, bg = c.bg })
      hi("NvimTreeFolderIcon",   { fg = c.blue })
      hi("NvimTreeFolderName",   { fg = c.blue })
      hi("NvimTreeOpenedFolderName", { fg = c.light_blue })
      hi("NvimTreeRootFolder",   { fg = c.magenta, bold = true })
      hi("NvimTreeGitDirty",     { fg = c.yellow })
      hi("NvimTreeGitNew",       { fg = c.green })
      hi("NvimTreeGitDeleted",   { fg = c.red })
      hi("NvimTreeIndentMarker", { fg = c.surface })

      -- Indent blankline
      hi("IblIndent",   { fg = c.surface })
      hi("IblScope",    { fg = c.muted })

      -- WhichKey
      hi("WhichKey",       { fg = c.magenta })
      hi("WhichKeyGroup",  { fg = c.blue })
      hi("WhichKeyDesc",   { fg = c.fg })
      hi("WhichKeyFloat",  { bg = c.bright_bg })
      hi("WhichKeySeparator", { fg = c.surface })

      -- Dashboard
      hi("DashboardHeader",   { fg = c.magenta })
      hi("DashboardCenter",   { fg = c.blue })
      hi("DashboardShortcut", { fg = c.yellow })
      hi("DashboardFooter",   { fg = c.muted, italic = true })
    '';

  # All HUD palette names
  hudPalettes = lib.filterAttrs (name: _: lib.hasPrefix "hud-" name) colors.lists;

  # Build a single vim plugin containing all colorschemes
  plugin = vimUtils.buildVimPlugin {
    pname = "hud-colorschemes";
    version = "0.0.0";
    src =
      let
        colorFiles = lib.mapAttrsToList (name: palette: {
          inherit name;
          file = mkColorscheme name palette;
        }) hudPalettes;
      in
      runCommand "hud-colorschemes-src" { } (
        ''
          mkdir -p $out/colors
        ''
        + lib.concatMapStrings ({ name, file }: "cp ${file} $out/colors/${name}.lua\n") colorFiles
      );
  };
in
plugin
