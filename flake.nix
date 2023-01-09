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
    home-manager.inputs.utils.follows = "flake-utils";

    # rust-overlay
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # Android Development
    android-nixpkgs.url = "github:tadfisher/android-nixpkgs";
    android-nixpkgs.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # utilities
    pre-commit-hooks.url = "github:cachix/pre-commit-hooks.nix";
    pre-commit-hooks.inputs.nixpkgs.follows = "nixpkgs-unstable";
  };

  outputs =
    { self
    , darwin
    , home-manager
    , flake-utils
    , pre-commit-hooks
    , ...
    } @inputs:

    let
      inherit (darwin.lib) darwinSystem;
      inherit (inputs.nixpkgs-unstable.lib) attrValues makeOverridable singleton;

      # Configuration for `nixpkgs`
      defaultNixpkgs = {
        config = { allowUnfree = true; };
        overlays = attrValues self.overlays
          ++ singleton (inputs.android-nixpkgs.overlays.default)
          ++ singleton (inputs.rust-overlay.overlays.default);
        #  ++ singleton (
        #  # Sub in x86 version of packages that don't build on Apple Silicon yet
        #  final: prev: (optionalAttrs (prev.stdenv.system == "aarch64-darwin") {
        #    inherit (final.pkgs-x86)
        #      yadm;
        #  })
        #)
      };

      # Personal configuration shared between `nix-darwin` and plain `home-manager` configs.
      homeManagerStateVersion = "23.05";

      primaryUserInfo = rec {
        username = "r17";
        fullName = "Rin";
        email = "hi@rin.rocks";
        nixConfigDirectory = "/Users/r17/.config/nixpkgs";
        within.neovim.enable = true;
      };

      # Modules shared by most `nix-darwin` personal configurations.
      nixDarwinCommonModules = attrValues self.commonModules ++ attrValues self.darwinModules ++ [
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
            nix.nixPath = { nixpkgs = "${primaryUser.nixConfigDirectory}/nixpkgs.nix"; };
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
    in
    {

      # Current Macbook Pro M1 from Ruangguru.com
      darwinConfigurations = rec {
        # TODO refactor darwin.nix to make common or bootstrap configuration
        bootstrap-x86 = makeOverridable darwinSystem {
          system = "x86_64-darwin";
          modules = with self.darwinModules;
            attrValues self.commonModules ++ [
              system-darwin
            ];
        };

        bootstrap-arm = bootstrap-x86.override { system = "aarch64-darwin"; };

        RG = makeOverridable darwinSystem {
          system = "aarch64-darwin";
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

        eR17 = makeOverridable darwinSystem {
          system = "aarch64-darwin";
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

      # Overlays --------------------------------------------------------------- {{{

      overlays = import ./modules/overlays inputs defaultNixpkgs;

      # `home-manager` modules
      homeManagerModules = {
        r17-activation = import ./home/activation.nix;
        r17-packages = import ./home/packages.nix;
        r17-shell = import ./home/shells.nix;
        r17-git = import ./home/git.nix;
        r17-tmux = import ./home/tmux.nix;
        r17-neovim = import ./home/neovim.nix;
        r17-alacritty = import ./home/alacritty.nix;
        r17-devshell = import ./home/devShell.nix;

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

      # `nix-darwin` modules that are pending upstream, or patched versions waiting on upstream
      # fixes.
      darwinModules = {
        system-darwin = import ./system/darwin/system.nix;
        system-darwin-packages = import ./system/darwin/packages.nix;
        # system-darwin-security-pam = import ./system/darwin/security.nix;
        system-darwin-gpg = import ./system/darwin/gpg.nix;
        system-darwin-window-manager = import ./system/darwin/wm.nix;
        system-darwin-homebrew = import ./system/darwin/homebrew.nix;
      };
    } // flake-utils.lib.eachDefaultSystem (system: rec {
      # nix flake check
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

      # nix develop 
      #
      # OR with current shell
      #
      # nix develop -C $SHELL 
      devShells.default =
        let
          pkgs = self.legacyPackages.${system};
          pre-commit-check = checks.pre-commit-check;
        in
        pkgs.mkShell {
          name = "r17x_nixpkgs";
          shellHook = '''' + pre-commit-check.shellHook;
          buildInputs = pre-commit-check.buildInputs or [ ];
          packages = pre-commit-check.packages or [ ];
        };

      legacyPackages = import inputs.nixpkgs-unstable (defaultNixpkgs // { inherit system; });
    });
}
