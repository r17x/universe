{ lib, config, pkgs, ... }:

with lib;

let
  inherit (config.lib.file) mkOutOfStoreSymlink;
  inherit (config.home.user-info) nixConfigDirectory within;
  inherit (pkgs) vimPlugins;

  cfg = within.neovim;

  mkOptionalPlugin = plugins: map (plugin: { inherit (plugin) plugin; optional = true; }) plugins;

  # TODO specific grammar
  # treesitter = vimPlugins.nvim-treesitter.withPlugins (p: [
  treesitter = vimPlugins.nvim-treesitter.withAllGrammars.overrideAttrs (_:
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

  lazyPlugins = with vimPlugins;
    let
      # finder with telescope
      telescope = builtins.map (plugin: { inherit plugin; lazy = true; }) [
        telescope-project-nvim
        telescope-github-nvim
        telescope-frecency-nvim
        neorg-telescope
      ];
    in
    telescope ++
    [
      {
        plugin = which-key-nvim;
        lazy = true;
      }

      {
        plugin = telescope-nvim;
        cmd = "Telescope";
      }

      {
        plugin = dashboard-nvim;
        event = "VimEnter";
      }

      {
        plugin = nvim-web-devicons;
        event = "UIEnter";
      }

      {
        # Theme
        plugin = edge;
        lazy = true;
      }

      {
        plugin = lsp-colors-nvim;
        event = "UIEnter";
      }

      {
        plugin = nvim-colorizer-lua;
        event = "UIEnter";
      }

      {
        # Tree files
        plugin = nvim-tree-lua;
        cmd = "NvimTreeToggle";
      }

      {
        # Taking notes
        plugin = neorg;
        cmd = "Neorg";
      }

      {
        plugin = treesitter;
        lazy = true;
      }

      {
        # magit in neovim
        plugin = vimagit;
        cmd = "Magit";
      }

      # LSP
      {
        plugin = nvim-lspconfig;
        lazy = true;
      }

      {
        plugin = lazy-lsp-nvim;
        lazy = true;
      }

      {
        plugin = lsp_signature-nvim;
        lazy = true;
      }

      {
        plugin = friendly-snippets;
        lazy = true;
      }

      {
        plugin = cmp-nvim-lsp;
        lazy = true;
      }

      {
        plugin = cmp-buffer;
        lazy = true;
      }

      {
        plugin = cmp-cmdline;
        lazy = true;
      }

      {
        plugin = cmp-path;
        lazy = true;
      }

      {
        plugin = luasnip;
        lazy = true;
      }

      {
        plugin = cmp_luasnip;
        lazy = true;
      }
    ];

  plugins = with vimPlugins; [ lazy-nvim ] ++ (mkOptionalPlugin lazyPlugins);

  /*
    https://github.com/folke/lazy.nvim#-plugin-spec
    Example:
    mapAttrsToList attrToLazyNvimSpec 
    { plugin = derivation_plugin; event = "VimEnter" }
    => [ "plugin=derivation_plugin" "event=\"VimEnter\"" ] 
  */
  attrToLazyNvimSpec = name: value:
    if name == "plugin" then ''dir = "${value.outPath}"''
    else if name == "lazy" then ''lazy = '' + lib.optionalString value "true"
    else ''${name} = "${value}"'';

  /*
    this function for generate nix attributes to lazy.nvim plguins spec

    example lua code output:
    { event = "VimEnter", dir = "/nix/store/1ylxphmw1yyb8n6sdqnhd8174g02adfr-vimplugin-dashboard-nvim-2022-12-31" },
    { event = "VimEnter",dir = "/nix/store/60mxsq55kd38gapdfb24r61jq9dy8wmf-vimplugin-nvim-web-devicons-2023-01-06" },
    { event = "VimEnter",dir = "/nix/store/68x1cir0qd423zrzf07r5k7s0p73nacc-vimplugin-edge-2022-12-31" },
    { event = "VimEnter",dir = "/nix/store/cc4ry1dmnpgy1b78nqqny59c5g9qbxl0-vimplugin-lsp-colors.nvim-2023-01-04" }
  */
  list2lazyNvimSpec = lazyPlugins:
    lib.strings.concatMapStringsSep ",\n" (p: "\t{ ${p} }")
      (builtins.map
        (lazyPlugin: lib.strings.concatStringsSep "," (lib.attrsets.mapAttrsToList attrToLazyNvimSpec lazyPlugin))
        lazyPlugins);
in
{
  options.within.vim.enable = mkEnableOption "Enables Within's vim config";

  config = mkIf cfg.enable {
    programs.neovim = {
      inherit plugins;
      defaultEditor = true;
      enable = cfg.enable;
      vimdiffAlias = true;
      withNodeJs = true;
      withPython3 = true;
      extraPackages = [ pkgs.gcc ];
      extraLuaPackages = ps: with ps; [
        # overlays
        pkgs.luajitPackages.luafun
        plenary-nvim
        nvim-cmp
      ];
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
        end

        return M
      '';
    });
  };
}
