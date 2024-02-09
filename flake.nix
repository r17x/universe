{
  description = "ri7's nix darwin system";

  inputs = {
    # Package sets
    nixpkgs.url = "github:NixOS/nixpkgs/release-23.05";
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixpkgs-23.05-darwin";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    # Other sources / nix utilities
    flake-compat = { url = "github:edolstra/flake-compat"; flake = false; };
    utils.url = "github:numtide/flake-utils";

    # Environment/system management
    darwin.url = "github:LnL7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";

    # home-manager inputs
    home-manager.url = "github:nix-community/home-manager/release-23.05";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # secret management 
    sops.url = "github:Mic92/sops-nix";
    sops.inputs.nixpkgs.follows = "nixpkgs";
    sops.inputs.nixpkgs-stable.follows = "nixpkgs-stable";

    # utilities
    precommit.url = "github:cachix/pre-commit-hooks.nix";
    precommit.inputs.nixpkgs.follows = "nixpkgs";

    # neovim
    neorg-overlay.url = "github:nvim-neorg/nixpkgs-neorg-overlay";
    neorg-overlay.inputs.nixpkgs.follows = "nixpkgs";
    neorg-overlay.inputs.flake-utils.follows = "utils";

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

  outputs =
    { self
    , darwin
    , home-manager
    , sops
    , utils
    , ...
    } @inputs:

    let
      inherit (darwin.lib) darwinSystem;
      inherit (self.lib) attrValues makeOverridable singleton optionalAttrs;
      # Overlays --------------------------------------------------------------------------------{{{

      config = { allowUnfree = true; };

      overlays =
        {
          # Overlays Package Sets ---------------------------------------------------------------{{{
          # Overlays to add different versions `nixpkgs` into package set
          pkgs-master = _: prev: {
            pkgs-master = import inputs.nixpkgs-master {
              inherit (prev.stdenv) system;
              inherit config;
            };
          };
          pkgs-stable = _: prev: {
            pkgs-stable = import inputs.nixpkgs-stable {
              inherit (prev.stdenv) system;
              inherit config;
            };
          };
          pkgs-unstable = _: prev: {
            pkgs-unstable = import inputs.nixpkgs-unstable {
              inherit (prev.stdenv) system;
              inherit config;
            };
          };
          apple-silicon = _: prev: optionalAttrs (prev.stdenv.system == "aarch64-darwin") {
            # Add access to x86 packages system is running Apple Silicon
            pkgs-x86 = import inputs.nixpkgs {
              system = "x86_64-darwin";
              inherit config;
            };
          };
          # ------------------------------------------------------------------------------------}}}

          mac-pkgs = import ./overlays/mac-pkgs;

          # Overlay that adds various additional utility functions to `vimUtils`
          vimUtils = import ./overlays/vimUtils.nix;

          treesitter = _final: prev: {
            tree-sitter-grammars = prev.tree-sitter-grammars // {
              tree-sitter-rescript =
                prev.pkgs-unstable.tree-sitter.buildGrammar {
                  version = inputs.ts-rescript.lastModifiedDate;
                  language = "rescript";
                  generate = true;
                  src = inputs.ts-rescript;
                };
            };
          };

          # Overlay that add some additional lua library
          luajitPackages = _final: prev: {
            luajitPackages = prev.luajitPackages // {
              luafun = prev.luajitPackages.buildLuarocksPackage {
                pname = "fun";
                version = "scm-1";

                src = inputs.luafun;

                disabled = (prev.luajitPackages.luaOlder "5.1") || (prev.luajitPackages.luaAtLeast "5.4");
                propagatedBuildInputs = [ prev.lua ];

                meta = {
                  homepage = "https://luafun.github.io/";
                  description = "High-performance functional programming library for Lua";
                  license.fullName = "MIT/X11";
                };
              };
            };
          };

          # Overlay that adds some additional Neovim plugins
          vimPlugins = _final: prev: {
            vimPlugins = prev.vimPlugins.extend (_: p: {
              nvim-treesitter = p.nvim-treesitter.overrideAttrs (_: {
                version = inputs.nvim-treesitter.lastModifiedDate;
                src = inputs.nvim-treesitter;
              });
            } // self.lib.mkFlake2VimPlugin { pkgs = prev; });
          };

        };

      # }}}

      # default configurations --------------------------------------------------------------{{{
      # Configuration for `nixpkgs`
      defaultNixpkgs = {
        inherit config;
        overlays = attrValues overlays
          ++ singleton (inputs.neorg-overlay.overlays.default)
          ++ singleton (inputs.dvt.overlay);
      };

      # Personal configuration shared between `nix-darwin` and plain `home-manager` configs.
      homeManagerStateVersion = "23.05";

      primaryUserInfo = rec {
        username = "r17";
        fullName = "Rin";
        email = "hi@rin.rocks";
        nixConfigDirectory = "/Users/${username}/.config/nixpkgs";
        within = {
          neovim.enable = true;
          gpg.enable = true;
          pass.enable = true;
        };
      };

      # Modules shared by most `nix-darwin` personal configurations.
      nixDarwinCommonModules = attrValues self.commonModules
        ++ attrValues self.darwinModules
        ++ [
        # `home-manager` module
        home-manager.darwinModules.home-manager
        (
          { config, pkgs, ... }:
          let
            inherit (config.users) primaryUser;
          in
          {
            nixpkgs = defaultNixpkgs;
            # Hack to support legacy worklows that use `<nixpkgs>` etc.
            nix.nixPath = { nixpkgs = "${inputs.nixpkgs}"; };
            # `home-manager` config
            users.users.${primaryUser.username} = {
              home = "/Users/${primaryUser.username}";
              shell = pkgs.fish;
            };

            home-manager.useGlobalPkgs = true;
            home-manager.users.${primaryUser.username} = {
              imports = attrValues self.homeManagerModules;
              home.stateVersion = homeManagerStateVersion;
              home.user-info = config.users.primaryUser;
            };

            # Add a registry entry for this flake
            nix.registry = {
              my.flake = self;
              dvt.flake = inputs.dvt;
            };
          }
        )
      ];

      # }}}
    in
    {

      lib = inputs.nixpkgs.lib.extend (_: _: {
        mkFlake2VimPlugin = import ./lib/mkFlake2VimPlugin.nix inputs;
      });

      # Modules --------------------------------------------------------------------------------{{{
      # Current Macbook Pro M1 from Ruangguru.com
      darwinConfigurations = rec {
        # TODO refactor darwin.nix to make common or bootstrap configuration
        bootstrap-x86 = makeOverridable darwinSystem {
          system = "x86_64-darwin";
          modules = attrValues self.commonModules;
        };

        bootstrap-arm = bootstrap-x86.override { system = "aarch64-darwin"; };

        RG = bootstrap-arm.override {
          modules = nixDarwinCommonModules ++ [
            {
              users.primaryUser = primaryUserInfo;
              networking.computerName = "RG";
              networking.hostName = "RG";
              networking.knownNetworkServices = [
                "Wi-Fi"
                "USB 10/100/1000 LAN"
              ];
            }
          ];
        };

        eR17 = RG.override {
          modules = nixDarwinCommonModules ++ [
            {
              users.primaryUser = primaryUserInfo;
              networking.computerName = "eR17";
              networking.hostName = "eR17";
              networking.knownNetworkServices = [
                "Wi-Fi"
                "USB 10/100/1000 LAN"
              ];
              homebrew.enable = true;
            }

            home-manager.darwinModules.home-manager
            ({ config, pkgs, ... }: {
              home-manager.users.${config.users.primaryUser.username} = {
                imports = singleton sops.homeManagerModule;
                home.packages = [ pkgs.sops ];
                sops.gnupg.home = "~/.gnupg";
                sops.gnupg.sshKeyPaths = [ ];
                sops.defaultSopsFile = ./secrets/secret.yaml;
                # git diff integrations
                programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d";
              };
            })
          ];
        };

        eR17x = eR17.override {
          modules = nixDarwinCommonModules ++ [
            {
              users.primaryUser = primaryUserInfo // rec {
                username = "er17x";
                nixConfigDirectory = "/Users/${username}/.config/nixpkgs";
              };
              networking.computerName = "eR17x";
              networking.hostName = "eR17x";
              networking.knownNetworkServices = [
                "Wi-Fi"
                "USB 10/100/1000 LAN"
              ];
              homebrew.enable = true;
            }

            home-manager.darwinModules.home-manager
            ({ config, pkgs, ... }: {
              home-manager.users.${config.users.primaryUser.username} = {
                imports = singleton sops.homeManagerModule;
                home.packages = [ pkgs.sops ];
                sops.gnupg.home = "~/.gnupg";
                sops.gnupg.sshKeyPaths = [ ];
                sops.defaultSopsFile = ./secrets/secret.yaml;
                # git diff integrations
                programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d";
              };
            })

          ];
        };

      };

      homeConfigurations.r17 =
        let
          pkgs = import inputs.nixpkgs (defaultNixpkgs // { system = "aarch64-darwin"; });
        in
        inputs.home-manager.lib.homeManagerConfiguration {
          inherit pkgs;
          modules = attrValues self.homeManagerModules
          ++ singleton ({ config, ... }: {
            home.username = config.home.user-info.username;
            home.homeDirectory = "/${if pkgs.stdenv.isDarwin then "Users" else "home"}/${config.home.username}";
            home.stateVersion = homeManagerStateVersion;
            home.user-info = primaryUserInfo // {
              nixConfigDirectory = "${config.home.homeDirectory}/.config/nixpkgs";
            };
          });
        };

      # `home-manager` modules
      homeManagerModules = {
        r17-alacritty = import ./home/alacritty.nix;
        r17-activation = import ./home/activation.nix;
        r17-packages = import ./home/packages.nix;
        r17-shell = import ./home/shells.nix;
        r17-git = import ./home/git.nix;
        r17-tmux = import ./home/tmux.nix;
        r17-neovim = import ./home/neovim.nix;
        gpg = import ./home/gpg.nix;
        pass = import ./home/pass.nix;

        home-user-info = { lib, ... }: {
          options.home.user-info =
            (self.commonModules.users-primaryUser { inherit lib; }).options.users.primaryUser;
        };
      };

      commonModules = {
        system = import ./system/system.nix;
        system-shells = import ./system/shells.nix;
        users-primaryUser = import ./modules/user.nix;
        programs-nix-index = import ./system/nix-index.nix;
      };

      # fixes.
      darwinModules = {
        system-darwin = import ./system/darwin/system.nix;
        system-darwin-packages = import ./system/darwin/packages.nix;
        # system-darwin-security-pam = import ./system/darwin/security.nix;
        system-darwin-gpg = import ./system/darwin/gpg.nix;
        system-darwin-window-manager = import ./system/darwin/mouseless.nix;
        system-darwin-homebrew = import ./system/darwin/homebrew.nix;
        system-darwin-network = import ./system/darwin/network.nix;
      };

      # }}}

    } // utils.lib.eachDefaultSystem (system: rec {

      legacyPackages = import inputs.nixpkgs (defaultNixpkgs // { inherit system; });

      # Checks ----------------------------------------------------------------------{{{
      # e.g., run `nix flake check` in $HOME/.config/nixpkgs.

      checks = {
        pre-commit-check = inputs.precommit.lib.${system}.run {
          src = ./.;
          # you can enable more hooks here {https://github.com/cachix/pre-commit-hooks.nix/blob/a4548c09eac4afb592ab2614f4a150120b29584c/modules/hooks.nix}
          hooks = {
            actionlint.enable = true;
            shellcheck.enable = true;
            stylua.enable = true;
            # TODO https://github.com/cachix/pre-commit-hooks.nix/issues/196
            # make override and pass configuration
            luacheck.enable = false;

            # .nix related
            deadnix.enable = true;
            nixpkgs-fmt.enable = true;
          };
        };
      };

      # }}}

      # Development shells ----------------------------------------------------------------------{{{
      # Shell environments for development
      # With `nix.registry.my.flake = inputs.self`, development shells can be created by running,
      # e.g., `nix develop my#node`. 

      devShells = import ./devShells.nix {
        pkgs = self.legacyPackages.${system};
        precommit = checks.pre-commit-check;
      };

      # }}}

    });
}

# vim: foldmethod=marker
