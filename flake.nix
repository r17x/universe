{
  description = "ri7's nix for darwin and linux system";

  inputs = {
    # Package sets
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixpkgs-22.05-darwin";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixos-stable.url = "github:NixOS/nixpkgs/nixos-22.05";

    # Environment/system management
    darwin.url = "github:LnL7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs-unstable";
    home-manager.inputs.flake-compat.follows = "flake-compat";
    home-manager.inputs.utils.follows = "flake-utils";

    # Other sources
    flake-compat = { url = "github:edolstra/flake-compat"; flake = false; };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, darwin, home-manager, flake-utils,  ... }@inputs:
    let
      inherit (darwin.lib) darwinSystem;
      inherit (inputs.nixpkgs-unstable.lib) attrValues makeOverridable optionalAttrs singleton;

      # Configuration for `nixpkgs`
      nixpkgsConfig = {
        config = { allowUnfree = true; };
        overlays = attrValues self.overlays ++ singleton (
          # Sub in x86 version of packages that don't build on Apple Silicon yet
          final: prev: (optionalAttrs (prev.stdenv.system == "aarch64-darwin") {
            inherit (final.pkgs-x86)
              discord
              yadm
              niv;
          })
        );
      };

      # Personal configuration shared between `nix-darwin` and plain `home-manager` configs.
      homeManagerStateVersion = "22.05";

      primaryUserInfo = {
        username = "r17";
        fullName = "Rin";
        email = "hi@rin.rocks";
        nixConfigDirectory = "/Users/r17/.config/nixpkgs";
      };

      # Modules shared by most `nix-darwin` personal configurations.
      nixDarwinCommonModules = attrValues self.commonModules ++ attrValues self.darwinModules ++ [
        # `home-manager` module
        home-manager.darwinModules.home-manager
        (
          { config, lib, pkgs, ... }:
          let
            inherit (config.users) primaryUser;
          in
          {
            nixpkgs = nixpkgsConfig;
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
      #  Current configuration for linux
      nixosConfigurations = rec {
        bootstrap-x86 = makeOverridable nixosSystem {
          system = "x86_64-linux";
          modules = [ ./system/bootstrap.nix { nixpkgs = nixpkgsConfig; } ];
        };
      };

      # Current Macbook Pro M1 from Ruangguru.com
      darwinConfigurations = rec {
        # TODO refactor darwin.nix to make common or bootstrap configuration
        bootstrap-x86 = makeOverridable darwinSystem {
          system = "x86_64-darwin";
          modules = [ 
            ./system/bootstrap.nix { nixpkgs = nixpkgsConfig; } 
            ./system/packages.nix { nixpkgs = nixpkgsConfig; } 
            ./system/nix-index.nix { nixpkgs = nixpkgsConfig; } 
          ];
        };

        bootstrap-arm = bootstrap-x86.override { system = "aarch64-darwin"; };

        RG = darwinSystem {
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

        githubCI = darwinSystem {
          system = "x86_64-darwin";
          modules = nixDarwinCommonModules ++ [
            {
              users.primaryUser = primaryUserInfo // {
                username = "runner";
                nixConfigDirectory = "/Users/runner/work/nixpkgs/nixpkgs";
              };
            }
          ];
        };
      };

      # Overlays --------------------------------------------------------------- {{{

      overlays = import ./modules/overlays inputs nixpkgsConfig;

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
        bootstrap-nix = import ./system/bootstrap.nix;
        system-packages = import ./system/packages.nix;
        users-primaryUser = import ./system/user.nix;
        programs-nix-index = import ./system/nix-index.nix;
      };

      # `nix-darwin` modules that are pending upstream, or patched versions waiting on upstream
      # fixes.
      darwinModules = {
        r17-darwin = import ./system/darwin;
        security-pam = import ./system/darwin/security.nix;
        r17-gpg = import ./system/darwin/gpg.nix;
        window-manager = import ./system/darwin/wm.nix;
      };
    } // flake-utils.lib.eachDefaultSystem (system: {
      legacyPackages = import inputs.nixpkgs-unstable {
        inherit system;
        inherit (nixpkgsConfig) config;
        overlays = with self.overlays; [
          pkgs-master
          pkgs-stable
          apple-silicon
        ];
      };
    });
}
