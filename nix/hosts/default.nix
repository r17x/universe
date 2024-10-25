{
  self,
  withSystem,
  inputs,
  ...
}:

let
  inherit (builtins) attrValues removeAttrs;

  mkDarwin =
    name:
    {
      system ? "aarch64-darwin",
      user ? self.users.default,
      stateVersion ? 4,
      homeManagerStateVersion ? "24.05",
      modules ? [ ],
    }:
    withSystem system (
      ctx:
      inputs.nix-darwin.lib.darwinSystem {
        inherit (ctx) system;
        specialArgs = {
          inherit inputs;
        };
        modules =
          attrValues self.commonModules
          ++ attrValues self.darwinModules
          ++ [
            # Composed home-manager configuration.
            inputs.home-manager.darwinModules.home-manager
            (
              { pkgs, config, ... }:
              {
                inherit (ctx) nix;
                mouseless.enable = true;
                homebrew.enable = true;
                _module.args = ctx.extraModuleArgs;
                nixpkgs = removeAttrs ctx.nixpkgs [ "hostPlatform" ];
                system.stateVersion = stateVersion;
                users.primaryUser = user;
                networking.hostName = name;
                networking.computerName = name;
                environment.systemPackages = ctx.basePackagesFor pkgs;
                # `home-manager` config
                users.users.${user.username} = {
                  home = "/Users/${user.username}";
                  shell = pkgs.fish;
                };
                home-manager.useGlobalPkgs = true;
                home-manager.useUserPackages = true;
                home-manager.users.${user.username} = {
                  imports = attrValues self.homeManagerModules ++ [
                    inputs.sops.homeManagerModules.sops
                    (
                      { ... }:
                      {
                        home.sessionVariables.EDITOR = "nvim";
                        home.sessionVariables.OPENAI_API_KEY = "$(cat ~/.config/sops-nix/secrets/openai_api_key)";
                      }
                    )
                  ];
                  home.enableNixpkgsReleaseCheck = false;
                  home.stateVersion = homeManagerStateVersion;
                  home.user-info = user;
                  home.username = user.username;
                  home.packages = [
                    pkgs.sops
                    self.packages.${system}.nvim
                    config.nix.package
                  ];
                  sops.gnupg.home = "~/.gnupg";
                  sops.gnupg.sshKeyPaths = [ ];
                  sops.defaultSopsFile = ../../secrets/secret.yaml;
                  sops.secrets.openai_api_key.path = "%r/openai_api_key";
                  sops.secrets.codeium.path = "%r/codeium";
                  # git diff integrations
                  programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d --config /dev/null";
                };
              }
            )
          ]
          ++ modules;
      }
    );

  mkDarwinConfigurations = configurations: builtins.mapAttrs mkDarwin configurations;
in

{
  flake.users = {
    default = rec {
      username = "r17";
      fullName = "Rin";
      email = "hi@rin.rocks";
      nixConfigDirectory = "/Users/${username}/.config/nixpkgs";
      within = {
        neovim.enable = false;
        gpg.enable = true;
        pass.enable = true;
      };
    };
  };

  # nix-darwin configurations
  flake.darwinConfigurations = mkDarwinConfigurations {
    eR17 = { };
    eR17x = { };
  };

  flake.nixOnDroidConfigurations.default =
    let
      stateVersion = "24.05";
    in
    inputs.nix-on-droid.lib.nixOnDroidConfiguration {
      pkgs = import inputs.nixpkgs {
        system = "aarch64-linux";
        overlays = inputs.nixpkgs.lib.attrValues self.overlays;
      };
      modules = [
        {
          system.stateVersion = stateVersion;
          nix.extraOptions = ''
            experimental-features = nix-command flakes
          '';
          home-manager.useGlobalPkgs = true;
          home-manager.config = {
            home.stateVersion = stateVersion;
            imports = [
              self.homeManagerModules.r17-shell
              self.homeManagerModules.r17-packages
            ];
          };
        }
      ];
    }

  ;
}
