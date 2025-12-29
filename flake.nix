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

      imports = [ ./nix ];
    };

  inputs = {
    # utilities for Flake
    flake-parts.url = "github:hercules-ci/flake-parts";
    ez-configs.url = "github:ehllie/ez-configs";
    ez-configs.inputs.nixpkgs.follows = "nixpkgs";
    ez-configs.inputs.flake-parts.follows = "flake-parts";

    ### -- nix related tools
    process-compose-flake.url = "github:Platonic-Systems/process-compose-flake";
    services-flake.url = "github:juspay/services-flake";

    ## -- nixpkgs
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/release-25.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixpkgs.follows = "nixpkgs-unstable";

    ### -- Nix Infra / DevOps
    microvm.url = "github:astro/microvm.nix?rev=1e746a8987eb893adc8dd317b84e73d72803b650";
    microvm.inputs.nixpkgs.follows = "nixpkgs";

    disko.url = "github:nix-community/disko";
    disko.inputs.nixpkgs.follows = "nixpkgs";

    clan-core.url = "github:clan-lol/clan-core";
    clan-core.inputs.nixpkgs.follows = "nixpkgs";
    clan-core.inputs.flake-parts.follows = "flake-parts";
    clan-core.inputs.sops-nix.follows = "sops-nix";
    clan-core.inputs.disko.follows = "disko";

    ### -- llms
    llms-agents.url = "github:numtide/llm-agents.nix";

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
    nixvim.inputs.flake-parts.follows = "flake-parts";

    ##### ---- ocaml
    ocaml-nvim.url = "github:syaiful6/ocaml.nvim";
    ocaml-nvim.inputs = {
      nixpkgs.follows = "nixpkgs";
      git-hooks.follows = "pre-commit-hooks";
    };

    #### irc
    iamb.url = "github:ulyssa/iamb";
    iamb.inputs.nixpkgs.follows = "nixpkgs";

    # secret management
    sops-nix.url = "github:Mic92/sops-nix";
    sops-nix.inputs.nixpkgs.follows = "nixpkgs";

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
