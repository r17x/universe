{
  description = "ri7's nix darwin system";

  inputs = {
    # Package sets
    nixpkgs.url = "github:NixOS/nixpkgs/release-23.05";
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixpkgs-22.11-darwin";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    # Other sources / nix utilities
    flake-compat = { url = "github:edolstra/flake-compat"; flake = false; };
    flake-utils.url = "github:numtide/flake-utils";

    # Environment/system management
    darwin.url = "github:LnL7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";

    # home-manager inputs
    home-manager.url = "github:nix-community/home-manager/release-23.05";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # utilities
    pre-commit-hooks.url = "github:cachix/pre-commit-hooks.nix";

    # neovim
    neorg-overlay.url = "github:nvim-neorg/nixpkgs-neorg-overlay";
    neorg-overlay.inputs.nixpkgs.follows = "nixpkgs";
    neorg-overlay.inputs.flake-utils.follows = "flake-utils";

    # dvt
    dvt.url = "github:efishery/dvt";
    dvt.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    { self
    , darwin
    , home-manager
    , flake-utils
    , ...
    } @inputs:

    let
      inherit (darwin.lib) darwinSystem;
      inherit (inputs.nixpkgs.lib) attrValues makeOverridable singleton optionalAttrs;
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

          treesitter = import ./overlays/treesitter.nix;

          # Overlya that add some additional lua library
          luajitPackages = import ./overlays/luajitPackages.nix;

          # Overlay that adds some additional Neovim plugins
          vimPlugins = import ./overlays/vimPlugins.nix;

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
            nix.registry.my.flake = self;
          }
        )
      ];

      # }}}
    in
    {

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

        eR17x = RG.override {
          modules = nixDarwinCommonModules ++ [
            {
              users.primaryUser = primaryUserInfo;
              networking.computerName = "eR17x";
              networking.hostName = "eR17x";
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
          pkgs = import inputs.nixpkgs (defaultNixpkgs // { system = "aarch64-darwin"; });
        in
        inputs.home-manager.lib.homeManagerConfiguration {
          inherit pkgs;
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
        gpg = import ./home/gpg.nix;
        pass = import ./home/pass.nix;
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

      legacyPackages = import inputs.nixpkgs (defaultNixpkgs // { inherit system; });

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
        {

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
              buildInputs = with ocamlPackages; [ ocaml merlin ];
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
