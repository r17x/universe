{
  description = "ri7's nix darwin system";

  inputs = {
    # Package sets
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixpkgs-22.11-darwin";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixos-stable.url = "github:NixOS/nixpkgs/nixos-22.11";

    # Other sources / nix utilities
    flake-compat = { url = "github:edolstra/flake-compat"; flake = false; };
    flake-utils.url = "github:numtide/flake-utils";

    # Environment/system management
    darwin.url = "github:LnL7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # home-manager inputs
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # rust-overlay
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # Android Development
    android-nixpkgs.url = "github:tadfisher/android-nixpkgs";
    android-nixpkgs.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # utilities
    pre-commit-hooks.url = "github:cachix/pre-commit-hooks.nix";

    # neovim
    neorg-overlay.url = "github:nvim-neorg/nixpkgs-neorg-overlay";
    neorg-overlay.inputs.nixpkgs.follows = "nixpkgs-unstable";
    neorg-overlay.inputs.flake-utils.follows = "flake-utils";

    # dvt
    dvt.url = "github:efishery/dvt";
    dvt.inputs.nixpkgs.follows = "nixpkgs-unstable";
  };

  outputs =
    { self
    , darwin
    , home-manager
    , flake-utils
    , pre-commit-hooks
    , neorg-overlay
    , dvt
    , ...
    } @inputs:

    let
      inherit (darwin.lib) darwinSystem;
      inherit (inputs.nixpkgs-unstable.lib) attrValues makeOverridable singleton optionalAttrs;

      # default configurations --------------------------------------------------------------{{{
      # Configuration for `nixpkgs`
      defaultNixpkgs = {
        config = { allowUnfree = true; };
        overlays = attrValues self.overlays
          ++ singleton (inputs.android-nixpkgs.overlays.default)
          ++ singleton (inputs.rust-overlay.overlays.default)
          ++ singleton (inputs.neorg-overlay.overlays.default);
      };

      # Personal configuration shared between `nix-darwin` and plain `home-manager` configs.
      homeManagerStateVersion = "23.05";

      primaryUserInfo = rec {
        username = "r17";
        fullName = "Rin";
        email = "hi@rin.rocks";
        nixConfigDirectory = "/Users/${username}/.config/nixpkgs";
        within.neovim.enable = true;
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
            nix.nixPath = { nixpkgs = "${inputs.nixpkgs-unstable}"; };
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
            nix.registry.my.flake = self;
          }
        )
      ];

      # }}}
    in
    {

      # Overlays --------------------------------------------------------------------------------{{{

      overlays = {
        # Overlays to add different versions `nixpkgs` into package set
        pkgs-master = _: prev: {
          pkgs-master = import inputs.nixpkgs-master {
            inherit (prev.stdenv) system;
            inherit (defaultNixpkgs) config;
          };
        };
        pkgs-stable = _: prev: {
          pkgs-stable = import inputs.nixpkgs-stable {
            inherit (prev.stdenv) system;
            inherit (defaultNixpkgs) config;
          };
        };
        pkgs-unstable = _: prev: {
          pkgs-unstable = import inputs.nixpkgs-unstable {
            inherit (prev.stdenv) system;
            inherit (defaultNixpkgs) config;
          };
        };
        apple-silicon = _: prev: optionalAttrs (prev.stdenv.system == "aarch64-darwin") {
          # Add access to x86 packages system is running Apple Silicon
          pkgs-x86 = import inputs.nixpkgs-unstable {
            system = "x86_64-darwin";
            inherit (defaultNixpkgs) config;
          };
        };

        mac-pkgs = import ./overlays/mac-pkgs;

        # Overlay that adds various additional utility functions to `vimUtils`
        vimUtils = import ./overlays/vimUtils.nix;

        # Overlya that add some additional lua library
        luajitPackages = _final: prev: {
          luajitPackages = prev.luajitPackages // {
            luafun = prev.luajitPackages.buildLuarocksPackage {
              pname = "fun";
              version = "scm-1";

              src = prev.fetchgit (removeAttrs
                (builtins.fromJSON ''{
  "url": "https://github.com/luafun/luafun",
  "rev": "cb6a7e25d4b55d9578fd371d1474b00e47bd29f3",
  "date": "2022-05-20T12:32:27+03:00",
  "path": "/nix/store/4ka959fym7brzx1hg7shlwsbrb5s5q5v-luafun",
  "sha256": "0p7s6jj2d8c7h6jar89b94i3jbbd092vq1a5grhhqga7glz979cn",
  "fetchLFS": false,
  "fetchSubmodules": false,
  "deepClone": false,
  "leaveDotGit": false
}'') [ "date" "path" ]);

              disabled = with prev.lua; (prev.luajitPackages.luaOlder "5.1") || (prev.luajitPackages.luaAtLeast "5.4");
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
        vimPlugins = final: prev:
          let
            inherit (self.overlays.pkgs-unstable final prev) pkgs-unstable;
            inherit (pkgs-unstable) fetchFromGitHub;
            inherit (self.overlays.vimUtils final prev) vimUtils;
          in
          {
            vimPlugins = prev.vimPlugins.extend (_: _:
              # Useful for testing/using Vim plugins that aren't in `nixpkgs`.
              vimUtils.buildVimPluginsFromFlakeInputs inputs [
                # Add flake input names here for a Vim plugin repos
              ] // {
                # Other Vim plugins
                # how to put packages here?
                # 1. add in schema inputs `inputs.repo_flake.url`
                # 2. add package name from inputs.repo_flake.packages.${prev.stdenv.system} package_name;
                # 3. done
                # e.g., `inherit (inputs.cornelis.packages.${prev.stdenv.system}) cornelis-vim;`

                # vimPlugins - overlays --------------------------------------------------------{{{

                lazy-nvim = vimUtils.buildVimPluginFrom2Nix {
                  pname = "lazy.nvim";
                  version = "2023-01-15";
                  src = fetchFromGitHub {
                    owner = "folke";
                    repo = "lazy.nvim";
                    rev = "984008f7ae17c1a8009d9e2f6dc007e13b90a744";
                    sha256 = "19hqm6k9qr5ghi6v6brxr410bwyi01mqnhcq071h8bibdi4f66cg";
                  };
                  meta.homepage = "https://github.com/folke/lazy.nvim";
                };

                git-conflict-nvim = vimUtils.buildVimPluginFrom2Nix {
                  pname = "git-conflict.nvim";
                  version = "2022-12-31";
                  src = fetchFromGitHub {
                    owner = "akinsho";
                    repo = "git-conflict.nvim";
                    rev = "cbefa7075b67903ca27f6eefdc9c1bf0c4881017";
                    sha256 = "1pli57rl2sglmz2ibbnjf5dxrv5a0nxk8kqqkq1b0drc30fk9aqi";
                  };
                  meta.homepage = "https://github.com/akinsho/git-conflict.nvim";
                };

                codeium-vim = vimUtils.buildVimPluginFrom2Nix {
                  pname = "codeium-vim";
                  version = "2023-02-08";
                  src = fetchFromGitHub {
                    owner = "Exafunction";
                    repo = "codeium.vim";
                    rev = "78382694eb15e1818ec6ff9ccd0389f63661b56f";
                    sha256 = "1b4lf0s8x3qqvpmyzz0a7j3ynvlzx8sx621dqbf8l3vl7nfkc4gy";
                  };
                  meta.homepage = "https://github.com/Exafunction/codeium.vim";
                };

                nvim-treesitter-rescript = vimUtils.buildVimPluginFrom2Nix {
                  pname = "nvim-treesitter-rescript";
                  version = "2023-03-05";
                  src = fetchFromGitHub {
                    owner = "nkrkv";
                    repo = "nvim-treesitter-rescript";
                    rev = "21ce711396b1d836a75781d65f34241f14161f94";
                    sha256 = "1bzlc8a9fsbda6dg27g52d9mcwfrpmk1b00bspksvq18d69m6n53";
                  };
                };
                # }}}
              }
            );
          };

        dvt = _final: prev: {
          dvt = inputs.dvt.packages.${prev.stdenv.system}.dvt;
        };
      };

      # }}}


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
          ];
        };
      };

      homeConfigurations.r17 =
        let
          pkgs = import inputs.nixpkgs-unstable (defaultNixpkgs // { system = "x86_64-linux"; });
        in
        inputs.home-manager.lib.homeManagerConfiguration {
          modules = attrValues self.homeManagerModules ++ singleton ({ config, ... }: {
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
        r17-activation = import ./home/activation.nix;
        r17-packages = import ./home/packages.nix;
        r17-shell = import ./home/shells.nix;
        r17-git = import ./home/git.nix;
        r17-tmux = import ./home/tmux.nix;
        r17-neovim = import ./home/neovim.nix;
        r17-alacritty = import ./home/alacritty.nix;
        # this module disabled, because shell environment
        # defined is evaluated first & it takes more spaces
        # in /nix/store
        # 
        # currently, using nix devShells.*
        # r17-devshell = import ./home/devShell.nix;

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
        system-darwin-window-manager = import ./system/darwin/wm.nix;
        system-darwin-homebrew = import ./system/darwin/homebrew.nix;
      };

      # }}}

    } // flake-utils.lib.eachDefaultSystem (system: rec {

      legacyPackages = import inputs.nixpkgs-unstable (defaultNixpkgs // { inherit system; });

      # Checks ----------------------------------------------------------------------{{{
      # e.g., run `nix flake check` in $HOME/.config/nixpkgs.

      checks = {
        pre-commit-check = inputs.pre-commit-hooks.lib.${system}.run {
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

      devShells = let pkgs = self.legacyPackages.${system}; in
        import ./devShells.nix { inherit pkgs; inherit (inputs.nixpkgs-unstable) lib; } // {

          # `nix develop my`.
          default = pkgs.mkShell {
            name = "r17x_devshells_default";
            shellHook = '''' + checks.pre-commit-check.shellHook;
            buildInputs = checks.pre-commit-check.buildInputs or [ ];
            packages = checks.pre-commit-check.packages or [ ];
          };

          # this development shell use for ocaml.org
          ocamlorg =
            let ocamlPackages = pkgs.ocaml-ng.ocamlPackages_4_14; in
            pkgs.mkShell {
              name = "r17x_ocaml_org";
              buildInputs = with ocamlPackages; [ ocaml ];
              nativeBuildInputs = with pkgs; [
                opam
                pkg-config
                libev
                oniguruma
                openssl
                gmp
              ];
            };

        };

      # }}}

    });
}

# vim: foldmethod=marker
