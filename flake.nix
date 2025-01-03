{
  description = "ri7's nix darwin system";

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      imports = [
        inputs.pre-commit-hooks.flakeModule
        inputs.process-compose-flake.flakeModule

        ./nix
        ./nvim.nix
      ];
    };

  inputs = {
    # utilities for Flake
    flake-parts.url = "github:hercules-ci/flake-parts";

    ## -- nixpkgs
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/release-24.05";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixpkgs.follows = "nixpkgs-unstable";

    ### -- nix related tools
    nixd.url = "github:nix-community/nixd";
    nixd.inputs.nixpkgs.follows = "nixpkgs";
    nixd.inputs.flake-parts.follows = "flake-parts";

    process-compose-flake.url = "github:Platonic-Systems/process-compose-flake";
    services-flake.url = "github:juspay/services-flake";

    ## -- Platform

    #### ---- MacOS
    nix-darwin.url = "github:LnL7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    #### ---- Home
    home-manager.url = "github:nix-community/home-manager/master";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    #### ---- Android
    nix-on-droid.url = "github:nix-community/nix-on-droid";
    nix-on-droid.inputs.nixpkgs.follows = "nixpkgs";
    nix-on-droid.inputs.home-manager.follows = "home-manager";

    #### ---- nixvim
    nixvim.url = "github:nix-community/nixvim";
    nixvim.inputs.nixpkgs.follows = "nixpkgs";
    nixvim.inputs.nix-darwin.follows = "nix-darwin";
    nixvim.inputs.home-manager.follows = "home-manager";
    nixvim.inputs.flake-parts.follows = "flake-parts";

    ## -- Ghostty
    # UNCOMMENT: when support build for aarch64-darwin or x86_64-darwin
    # ghostty.url = "git+ssh://git@github.com/ghostty-org/ghostty";
    # ghostty.inputs.nixpkgs-stable.follows = "nixpkgs";
    # ghostty.inputs.nixpkgs-unstable.follows = "nixpkgs";

    ## -- Languages
    ocaml-overlay.url = "github:nix-ocaml/nix-overlays";
    ocaml-overlay.inputs.nixpkgs.follows = "nixpkgs";
    server-reason-react = {
      url = "github:ml-in-barcelona/server-reason-react";
      flake = false;
    };
    quickjs-ml = {
      url = "git+https://github.com/ml-in-barcelona/quickjs.ml?submodules=1";
      flake = false;
    };
    styled-ppx = {
      url = "github:davesnx/styled-ppx?rev=2b69b67ab10244aed612005bd127031f16289cc7";
      flake = false;
    };

    iamb.url = "github:ulyssa/iamb";
    iamb.inputs.nixpkgs.follows = "nixpkgs";

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
    vimPlugins_vim-rescript = {
      url = "github:rescript-lang/vim-rescript";
      flake = false;
    };

    vimPlugins_lackluster = {
      url = "github:slugbyte/lackluster.nvim";
      flake = false;
    };

    # others
    nix-env = {
      url = "github:lilyball/nix-env.fish";
      flake = false;
    };

    sketchybar-app-font = {
      url = "github:kvndrsslr/sketchybar-app-font";
      flake = false;
    };
  };
}
