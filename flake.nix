{
  description = "ri7's nix darwin system";

  inputs = {
    # Package sets
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-21.11-darwin";
    nixpkgs-unstable.url = github:NixOS/nixpkgs/nixpkgs-unstable;

    # Environment/system management
    darwin.url = "github:lnl7/nix-darwin/master";
    darwin.inputs.nixpkgs.follows = "nixpkgs-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs-unstable";

    # Other sources
    comma = { url = github:Shopify/comma; flake = false; };
    flake-compat = { url = github:edolstra/flake-compat; flake = false; };
    flake-utils.url = github:numtide/flake-utils;
  };

  outputs = { self, darwin, nixpkgs, flake-utils, home-manager, ... }@inputs:
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
            nix-index
            niv;
        })
      );
    }; 

    # Personal configuration shared between `nix-darwin` and plain `home-manager` configs.
    homeManagerStateVersion = "22.05";
    homeManagerCommonConfig = {
      imports = attrValues self.homeManagerModules ++ [
        ./home
        { home.stateVersion = homeManagerStateVersion; }
      ];
    };

    # Modules shared by most `nix-darwin` personal configurations.
    nixDarwinCommonModules = attrValues self.darwinModules ++ [
      # Main `nix-darwin` config
      ./darwin.nix
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
          nix.nixPath = { nixpkgs = "$HOME/.config/nixpkgs/nixpkgs.nix"; };
          # `home-manager` config
          users.users.${primaryUser}.home = "/Users/${primaryUser}";
          home-manager.useGlobalPkgs = true;
          home-manager.users.${primaryUser} = homeManagerCommonConfig;
          # Add a registry entry for this flake
          nix.registry.my.flake = self;
        }
      )
    ];
  in
  {
    # Current Macbook Pro M1 from Ruangguru.com
    darwinConfigurations = rec {
      RG = darwinSystem {
        system = "aarch64-darwin";
        modules = nixDarwinCommonModules ++ [
          {
            users.primaryUser = "r17";
            networking.computerName = "RG";
            networking.hostName = "RG";
            networking.knownNetworkServices = [
              "Wi-Fi"
              "USB 10/100/1000 LAN"
            ];
          }
        ];
      };
    };

    # Overlays --------------------------------------------------------------- {{{

    overlays = {
      # Overlays to add different versions `nixpkgs` into package set
      pkgs-master = final: prev: {
        pkgs-master = import inputs.nixpkgs-master {
          inherit (prev.stdenv) system;
          inherit (nixpkgsConfig) config;
        };
      };
      pkgs-stable = final: prev: {
        pkgs-stable = import inputs.nixpkgs-stable {
          inherit (prev.stdenv) system;
          inherit (nixpkgsConfig) config;
        };
      };
      pkgs-unstable = final: prev: {
        pkgs-unstable = import inputs.nixpkgs-unstable {
          inherit (prev.stdenv) system;
          inherit (nixpkgsConfig) config;
        };
      };

      comma = final: prev: {
        comma = import inputs.comma { inherit (prev) pkgs; };
      };  

      # Overlay useful on Macs with Apple Silicon
      apple-silicon = final: prev: optionalAttrs (prev.stdenv.system == "aarch64-darwin") {
        # Add access to x86 packages system is running Apple Silicon
        pkgs-x86 = import inputs.nixpkgs-unstable {
          system = "x86_64-darwin";
          inherit (nixpkgsConfig) config;
        };
      }; 
    };

    # `home-manager` modules
    homeManagerModules = {};

    # `nix-darwin` modules that are pending upstream, or patched versions waiting on upstream
    # fixes.
    darwinModules = {
      users = 
        { lib, ... }:
        let
          inherit (lib) mkOption types;
        in
        {
          options = {
            users.primaryUser = mkOption {
              type = with types; nullOr string;
              default = null;
            };
          };
        };
      programs-nix-index = 
        # Additional configuration for `nix-index` to enable `command-not-found` functionality with Fish.
        { config, lib, pkgs, ... }:

        {
          config = lib.mkIf config.programs.nix-index.enable {
            programs.fish.interactiveShellInit = ''
              function __fish_command_not_found_handler --on-event="fish_command_not_found"
                ${if config.programs.fish.useBabelfish then ''
                command_not_found_handle $argv
                '' else ''
                ${pkgs.bashInteractive}/bin/bash -c \
                  "source ${config.programs.nix-index.package}/etc/profile.d/command-not-found.sh; command_not_found_handle $argv"
                ''}
              end
            '';
            };
        };

      security-pam = 
        # Upstream PR: https://github.com/LnL7/nix-darwin/pull/228
        { config, lib, pkgs, ... }:

        with lib;

        let
          cfg = config.security.pam;

          # Implementation Notes
          #
          # We don't use `environment.etc` because this would require that the user manually delete
          # `/etc/pam.d/sudo` which seems unwise given that applying the nix-darwin configuration requires
          # sudo. We also can't use `system.patchs` since it only runs once, and so won't patch in the
          # changes again after OS updates (which remove modifications to this file).
          #
          # As such, we resort to line addition/deletion in place using `sed`. We add a comment to the
          # added line that includes the name of the option, to make it easier to identify the line that
          # should be deleted when the option is disabled.
          mkSudoTouchIdAuthScript = isEnabled:
          let
            file   = "/etc/pam.d/sudo";
            option = "security.pam.enableSudoTouchIdAuth";
          in ''
            ${if isEnabled then ''
              # Enable sudo Touch ID authentication, if not already enabled
              if ! grep 'pam_tid.so' ${file} > /dev/null; then
                sed -i "" '2i\
              auth       sufficient     pam_tid.so # nix-darwin: ${option}
                ' ${file}
              fi
            '' else ''
              # Disable sudo Touch ID authentication, if added by nix-darwin
              if grep '${option}' ${file} > /dev/null; then
                sed -i "" '/${option}/d' ${file}
              fi
            ''}
          '';
        in

        {
          options = {
            security.pam.enableSudoTouchIdAuth = mkEnableOption ''
              Enable sudo authentication with Touch ID
              When enabled, this option adds the following line to /etc/pam.d/sudo:
                  auth       sufficient     pam_tid.so
              (Note that macOS resets this file when doing a system update. As such, sudo
              authentication with Touch ID won't work after a system update until the nix-darwin
              configuration is reapplied.)
            '';
          };

          config = {
            system.activationScripts.extraActivation.text = ''
              # PAM settings
              echo >&2 "setting up pam..."
              ${mkSudoTouchIdAuthScript cfg.enableSudoTouchIdAuth}
            '';
          };
        };
    };
 }// flake-utils.lib.eachDefaultSystem (system: {
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
