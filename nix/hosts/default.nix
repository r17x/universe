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
                mouseless.wm = "aerospace";
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
                home-manager.backupFileExtension = ".backup-before-nix-home-manager";
                home-manager.useGlobalPkgs = true;
                home-manager.useUserPackages = true;
                home-manager.extraSpecialArgs = {
                  inherit (ctx.extraModuleArgs)
                    colors
                    color
                    icons
                    branches
                    ;
                };

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
                  programs.terminal.use = "ghostty";
                };
              }
            )
          ]
          ++ modules;
      }
    );

  mkDarwinConfigurations = configurations: builtins.mapAttrs mkDarwin configurations;

  mkDroidConfiguration =
    {
      system,
      modules ? [ ],
    }:
    withSystem system (
      ctx:
      inputs.nix-on-droid.lib.nixOnDroidConfiguration {
        inherit (ctx) pkgs;
        modules = [
          {
            nix = {
              inherit (ctx.nix)
                nixPath
                registry
                package
                ;
              extraOptions = ''
                experimental-features = nix-command flakes pipe-operators
              '';
            };
          }
        ] ++ modules;
      }
    );
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
    eR17x = {
      modules = [
        {
          nix.settings.builders-use-substitutes = true;
          nix.linux-builder = {
            enable = true;
            ephemeral = true;
            maxJobs = 4;
            config = {
              virtualisation = {
                darwin-builder = {
                  diskSize = 40 * 1024;
                  memorySize = 8 * 1024;
                };
                cores = 6;
              };
              nix.settings.sandbox = false;
              users.users.root.openssh.authorizedKeys.keys = [
                "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKvi3Co5fB1dSU2Qs1sR6LwdB1hM6HCyIWfXsC0wgz1pmeFlje24SzPCxDtsVMq28fDpEBsXPqKSZbUIyBtHRnpIc72Z8IV0KNtBjbKQTfHLTiDu43e+VLuAdFE7u2Wf5KPQIQ52r/jr9P7UKU2GKwV016OzrRiaZjm+gixmd8YRfidzG1bsL5fbKBjxCIUROdVpW5kNNtPZHpeuHCkZ7341USC6V2qnp1BNHIoHLjRYosV82apOxN/AWY/tMN2jlVQ/gKIUHbxXoILsG+XRFCen5TSSearx54KxifI1aIWbxVVmmYNuLXGWnVumaH6U7ARpz2cEXQB9z2lvJGYmod8qfloVdjXESu8OFe4RT+nj0JUQs7pMhiN6K1AsMQiyFc0ZmU2UNx4JcHre5STnSKUHUCx4zzoToFvIQRBTB3HePHy74FcXWaYDAN/6YF3JEA203nyYL4o5m/KhSXNkcT3H+r3IAqKnl7J7obsvNowwa1UB2NxVmq0VXXR8uZlT0="
              ];
            };
          };
          nix.settings.trusted-users = [ "@admin" ];
        }
      ];
    };
  };

  flake.nixOnDroidConfigurations.default = mkDroidConfiguration rec {
    system = "aarch64-linux";
    modules = [
      (
        { pkgs, ... }:
        {
          system.stateVersion = "24.05";
          home-manager.backupFileExtension = "backup-before-nix";
          home-manager.useGlobalPkgs = true;
          home-manager.config = {
            home.stateVersion = "24.05";
            home.packages = [
              pkgs.coreutils
              pkgs.gnused
              pkgs.gawk
              self.packages.${system}.nvim
            ];
            imports = [
              self.homeManagerModules.r17-shell
            ];
          };
        }
      )
    ];
  };

}
