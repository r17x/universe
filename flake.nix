{
  description = "ri7's nix darwin system";

  outputs = inputs: inputs.parts.lib.mkFlake { inherit inputs; } {
    systems = [
      "aarch64-darwin"
      "x86_64-linux"
    ];

    imports = [
      inputs.pre-commit-hooks.flakeModule
      ./modules/overlays
      ./modules/parts
      ./modules/devShells.nix
      ./hosts
      ./nvim.nix
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
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/release-22.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixpkgs.follows = "nixpkgs-unstable";

    ## -- Platform

    #### ---- MacOS
    nix-darwin.url = "github:LnL7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    #### ---- Home
    home-manager.url = "github:nix-community/home-manager/master";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    #### ---- nixvim
    nixvim.url = "github:nix-community/nixvim";
    nixvim.inputs.nixpkgs.follows = "nixpkgs";
    neorg-overlay.url = "github:nvim-neorg/nixpkgs-neorg-overlay";
    neorg-overlay.inputs.nixpkgs.follows = "nixpkgs";

    # secret management 
    sops.url = "github:Mic92/sops-nix";
    sops.inputs.nixpkgs.follows = "nixpkgs";
    sops.inputs.nixpkgs-stable.follows = "nixpkgs-stable";

    # utilities
    pre-commit-hooks.url = "github:cachix/pre-commit-hooks.nix";
    pre-commit-hooks.inputs.nixpkgs.follows = "nixpkgs";

    # vimPlugins from flake inputs
    # prefix "vimPlugins_"
    # e.g: rescript-nvim to be vimPlugins_rescript-nvim
    # e.g usage: programs.neovim.plugins = p: [p.rescript-nvim] or [pkgs.vimPlugins.rescript-nvim];
    vimPlugins_vim-rescript = { url = "github:rescript-lang/vim-rescript"; flake = false; };
    vimPlugins_nvim-treesitter-rescript = { url = "github:nkrkv/nvim-treesitter-rescript"; flake = false; };

    # others 
    ts-rescript = { url = "github:nkrkv/tree-sitter-rescript"; flake = false; };
    luafun = { url = "github:luafun/luafun"; flake = false; };
  };
}
