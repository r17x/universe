{
  description = "ri7's nix darwin system";

  outputs = inputs: inputs.parts.lib.mkFlake { inherit inputs; } {
    systems = [
      "aarch64-darwin"
      "x86_64-linux"
    ];

    imports = [
      inputs.precommit.flakeModule
      ./devShells.nix
      ./overlays
      ./modules/parts
      ./hosts
    ];
  };

  inputs = {
    nix.url = "github:nixos/nix";
    nix.inputs.nixpkgs.follows = "nixpkgs";

    nix-index-database.url = "github:Mic92/nix-index-database";
    nix-index-database.inputs.nixpkgs.follows = "nixpkgs";

    # utilities for Flake
    parts.url = "github:hercules-ci/flake-parts";
    nixpkgs-fmt.url = "github:nix-community/nixpkgs-fmt";
    nixpkgs-fmt.inputs.nixpkgs.follows = "nixpkgs";

    ## -- nixpkgs 
    master.url = "github:NixOS/nixpkgs/master";
    stable.url = "github:NixOS/nixpkgs/release-22.11";
    unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixpkgs.follows = "master";

    ## -- Platform

    #### ---- MacOS
    darwin.url = "github:LnL7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";

    #### ---- Home
    home.url = "github:nix-community/home-manager/release-23.05";
    home.inputs.nixpkgs.follows = "nixpkgs";

    # secret management 
    sops.url = "github:Mic92/sops-nix";
    sops.inputs.nixpkgs.follows = "nixpkgs";
    sops.inputs.nixpkgs-stable.follows = "stable";

    # utilities
    precommit.url = "github:cachix/pre-commit-hooks.nix";
    precommit.inputs.nixpkgs.follows = "nixpkgs";
    # dvt
    dvt.url = "github:efishery/dvt";
    dvt.inputs.nixpkgs.follows = "nixpkgs";

    # vimPlugins from flake inputs
    # prefix "vimPlugins_"
    # e.g: rescript-nvim to be vimPlugins_rescript-nvim
    # e.g usage: programs.neovim.plugins = p: [p.rescript-nvim] or [pkgs.vimPlugins.rescript-nvim];
    vimPlugins_vim-rescript = { url = "github:rescript-lang/vim-rescript"; flake = false; };
    vimPlugins_nvim-treesitter-rescript = { url = "github:nkrkv/nvim-treesitter-rescript"; flake = false; };
    vimPlugins_lazy-nvim = { url = "github:folke/lazy.nvim"; flake = false; };
    # vimPlugins_codeium-vim = { url = "github:Exafunction/codeium.vim"; flake = false; };
    vimPlugins_codeium = { url = "github:jcdickinson/codeium.nvim"; flake = false; };
    vimPlugins_git-conflict-nvim = { url = "github:akinsho/git-conflict.nvim"; flake = false; };
    vimPlugins_chatgpt-nvim = { url = "github:jackMort/ChatGPT.nvim"; flake = false; };

    # others 
    nvim-treesitter = { url = "github:r17x/nvim-treesitter"; flake = false; };
    ts-rescript = { url = "github:nkrkv/tree-sitter-rescript"; flake = false; };
    luafun = { url = "github:luafun/luafun"; flake = false; };
  };
}
