{ lib, config, pkgs, ... }:

with lib;

let
  inherit (config.lib.file) mkOutOfStoreSymlink;
  inherit (config.home.user-info) nixConfigDirectory within;
  inherit (pkgs) vimPlugins;

  cfg = within.neovim;

  plugin2Optional = p: { plugin = p; optional = p.lazy or true; };

  mkOptionalPlugin = plugins: map plugin2Optional
    (builtins.foldl' (ps: p: ps ++ singleton p.plugin ++ p.dependencies or [ ]) [ ] plugins);

  # TODO specific grammar
  # treesitter = vimPlugins.nvim-treesitter.withPlugins (p: [
  treesitter = (vimPlugins.nvim-treesitter.withPlugins (_:
    vimPlugins.nvim-treesitter.allGrammars
    ++ [ pkgs.tree-sitter-grammars.tree-sitter-rescript ])).overrideAttrs (_:
    let
      treesitter-parser-paths =
        pkgs.symlinkJoin {
          name = "treesitter-parsers";
          paths = (treesitter).dependencies;
        };
    in
    {
      postPatch = ''
        mkdir -p parser
        cp -r ${treesitter-parser-paths.outPath}/parser/*.so parser
      '';
    });

  # lazy-nvim - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - {{{

  lazyPlugins = with vimPlugins;
    let
      ui = [
        # Theme
        { plugin = edge; lazy = true; }

        # Tree files
        { plugin = nvim-tree-lua; event = "UIEnter"; }

        { plugin = which-key-nvim; event = "UIEnter"; }

        {
          plugin = dashboard-nvim;
          event = "UIEnter";
          dependencies = [
            neoscroll-nvim
          ];
        }

        { plugin = nvim-web-devicons; event = "UIEnter"; }

      ];

      userTyping = [
        { plugin = tagbar; cmd = "TagbarToggle"; }

        { plugin = vim-rescript; ft = [ "rescript" ]; }

        { plugin = nvim-colorizer-lua; event = "BufReadPre"; }

        # git
        { plugin = gitsigns-nvim; event = "BufReadPost"; }

        # platform integrations
        { plugin = vim-wakatime; event = "BufRead"; }

        # { plugin = codeium-vim; cmd = "EnableCodeium"; }

        # lang-server-protocol ---{{{
        { plugin = conjure; cmd = "ConjureShadowSelect"; }

        {
          plugin = lazy-lsp-nvim;
          event = "BufReadPre";
          dependencies = [
            nvim-lspconfig
            treesitter
            lsp_signature-nvim
            lsp-inlayhints-nvim
            lsp-colors-nvim
            trouble-nvim
          ];
        }
        # }}}

        # completions ------------{{{
        {
          plugin = nvim-cmp;
          event = "InsertEnter";
          dependencies = [
            codeium
            friendly-snippets
            cmp-nvim-lsp
            cmp-nvim-lsp-signature-help
            cmp-buffer
            cmp-cmdline
            cmp-path
            luasnip
            cmp_luasnip
            cmp-conjure
          ];
        }
        # }}}

        { plugin = git-conflict-nvim; event = "BufRead"; }

        { plugin = indent-blankline-nvim; event = "BufRead"; }

        {
          plugin = lualine-nvim;
          event = "BufRead";
          dependencies = [
            lualine-lsp-progress
          ];
        }

        # this plugins is utilities before new buffer want to write a file when directory is NOT existed.
        {
          plugin = mkdir-nvim;
          event = "FileWritePre";
        }
        {
          plugin = comment-nvim;
          keys = [ "gcc" "gbc" ];
        }
      ];

      byCommand = [
        # finder with telescope ---{{{
        {
          plugin = telescope-nvim;
          cmd = "Telescope";
          dependencies = [
            telescope-project-nvim
            telescope-github-nvim
            telescope-frecency-nvim
            neorg-telescope
          ];
        }
        # }}}

        # learn - repl related
        {
          plugin = codi-vim;
          cmd = [ "Codi" "CodiNew" "CodiSelect" "CodeExpand" ];
        }

        # markdown preview
        {
          plugin = markdown-preview-nvim;
          cmd = [ "MarkdownPreview" ];
        }

        # secrets
        {
          plugin = vim-gnupg;
          ft = [ "gpg" "gnugpg" "pgp" ];
        }

        { plugin = git-messenger-vim; cmd = "GitMessenger"; }

        # Writing & Taking notes
        { plugin = neorg; cmd = "Neorg"; }
        { plugin = zen-mode-nvim; cmd = "ZenMode"; }

        # magit in neovim
        { plugin = vimagit; cmd = "Magit"; }

      ];
    in
    ui ++ userTyping ++ byCommand;

  # plugins =

  # }}}
  doubleQuote = v: ''"${v}"'';
  brackets = v: "{ ${v} }";
  tab = v: "\t${v}";
  commaEnter = ",\n";
  /*
    https://github.com/folke/lazy.nvim#-plugin-spec
    Example:
    mapAttrsToList attrToLazyNvimSpec 
    { plugin = derivation_plugin; event = "VimEnter" }
    => [ "plugin=derivation_plugin" "event=\"VimEnter\"" ] 
  */
  attrToLazyNvimSpec = name: value:
    let
      k = if name == "plugin" then "dir" else name;
      v = if isBool value then boolToString value else
      if isList value
      then brackets (strings.concatMapStringsSep "," (p: if isDerivation p then doubleQuote "${p.outPath}" else doubleQuote p) value)
      else doubleQuote value;
    in
    ''${k} = ${v}'';
  /*
    this function for generate nix attributes to lazy.nvim plguins spec

    example lua code output:
    { event = "VimEnter", dir = "/nix/store/1ylxphmw1yyb8n6sdqnhd8174g02adfr-vimplugin-dashboard-nvim-2022-12-31" },
    { event = "VimEnter",dir = "/nix/store/60mxsq55kd38gapdfb24r61jq9dy8wmf-vimplugin-nvim-web-devicons-2023-01-06" },
    { event = "VimEnter",dir = "/nix/store/68x1cir0qd423zrzf07r5k7s0p73nacc-vimplugin-edge-2022-12-31" },
    { event = "VimEnter",dir = "/nix/store/cc4ry1dmnpgy1b78nqqny59c5g9qbxl0-vimplugin-lsp-colors.nvim-2023-01-04" }
  */
  attrToTables = plugin: strings.concatStringsSep "," (attrsets.mapAttrsToList attrToLazyNvimSpec plugin);
  list2lazyNvimSpec = lazyPlugins:
    strings.concatMapStringsSep commaEnter (p: tab (brackets p))
      (builtins.foldl'
        (ps: p: ps
          ++ map attrToTables (singleton p ++ map (p: { plugin = p; lazy = true; }) p.dependencies or [ ])) [ ]
        lazyPlugins);
  # (lazyPlugin: strings.concatStringsSep "," (attrsets.mapAttrsToList attrToLazyNvimSpec lazyPlugin))
  # lazyPlugins);
in
{
  options.within.vim.enable = mkEnableOption "Enables Within's vim config";

  config = mkIf cfg.enable {
    programs.neovim = {
      plugins = singleton vimPlugins.lazy-nvim
        ++ mkOptionalPlugin lazyPlugins;
      defaultEditor = true;
      enable = cfg.enable;
      vimdiffAlias = true;
      withNodeJs = true;
      withPython3 = true;
      extraPackages = with pkgs; [ ];
      extraLuaPackages = ps: with ps; [
        # overlays
        pkgs.luajitPackages.luafun
        plenary-nvim
      ];
      package = pkgs.neovim-unwrapped.overrideAttrs (old: {
        postFixup = old.preFixup or "" + ''
          $out/bin/nvim --headless +TSInstall rescript +qa
        '';
      });
    };

    # impure configurations
    xdg.configFile."nvim/init.lua".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/init.lua";
    xdg.configFile."nvim/stylua.toml".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/stylua.toml";
    xdg.configFile."nvim/lua/core".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/lua/core";
    xdg.configFile."nvim/lua/config".source = mkOutOfStoreSymlink "${nixConfigDirectory}/configs/nvim/lua/config";
    # generate $HOME/.config/nvim/lua/gen/lazy.lua
    xdg.configFile."nvim/lua/gen/lazy.lua".source = mkOutOfStoreSymlink (pkgs.writeTextFile {
      name = "init.lua";
      executable = false;
      text = ''
        local M = {}

        M.opts  = {
          install = {
            missing = false;
          },
          readme = {
              root =  "${nixConfigDirectory}/configs/nvim/readme",
              files = { "README.md", "lua/**/README.md" },
              -- only generate markdown helptags for plugins that dont have docs
              skip_if_doc_exists = true,
          },
        }

        M.plugins = {
        ${list2lazyNvimSpec lazyPlugins}
        }

        M.init = function(opts)
          require("lazy").setup(M.plugins, opts or M.opts)
          vim.g.tagbar_ctags_bin = "${pkgs.universal-ctags}/bin/ctags"
        end

        return M
      '';
    });
  };
}

# vim: foldmethod=marker
