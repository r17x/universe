{ self, withSystem, inputs, ... }:

let
  inherit (builtins) attrValues removeAttrs;

  mkDarwin = name: { system ? "aarch64-darwin", user ? self.users.default, stateVersion ? 4, homeManagerStateVersion ? "24.05", modules ? [ ] }: withSystem system (ctx:
    inputs.nix-darwin.lib.darwinSystem {
      inherit (ctx) system;
      specialArgs = { inherit inputs; };
      modules = attrValues self.commonModules
        ++ attrValues self.darwinModules
        ++ [
        # Composed home-manager configuration.
        inputs.home-manager.darwinModules.home-manager
        ({ pkgs, config, ... }: {
          inherit (ctx) nix;
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
              ({ ... }: {
                home.sessionVariables.EDITOR = "nvim";
                home.sessionVariables.OPENAI_API_KEY = "$(cat ~/.config/sops-nix/secrets/openai_api_key)";
              })
            ];
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
            sops.defaultSopsFile = ../secrets/secret.yaml;
            sops.secrets.openai_api_key.path = "%r/openai_api_key";
            sops.secrets.codeium.path = "%r/codeium";
            # git diff integrations
            programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d --config /dev/null";
          };
        })
      ] ++ modules;
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
  flake.commonModules = {
    system-shells = import ../shared/shells.nix;
    users-primaryUser = import ../shared/user.nix;
    programs-nix-index = import ../shared/nix-index.nix;
  };
  flake.darwinModules = {
    system-darwin = import ../shared/darwin/system.nix;
    system-darwin-packages = import ../shared/darwin/packages.nix;
    system-darwin-gpg = import ../shared/darwin/gpg.nix;
    system-darwin-window-manager = import ../shared/darwin/mouseless.nix;
    system-darwin-homebrew = import ../shared/darwin/homebrew.nix;
    system-darwin-network = import ../shared/darwin/network.nix;
  };
  # `home-manager` modules
  flake.homeManagerModules = {
    r17-alacritty = import ../home/alacritty.nix;
    r17-activation = import ../home/activation.nix;
    r17-packages = import ../home/packages.nix;
    r17-shell = import ../home/shells.nix;
    r17-git = import ../home/git.nix;
    r17-tmux = import ../home/tmux.nix;
    r17-neovim = import ../home/neovim.nix;
    gpg = import ../home/gpg.nix;
    pass = import ../home/pass.nix;
    home-user-info = { lib, ... }: {
      options.home.user-info =
        (self.commonModules.users-primaryUser { inherit lib; }).options.users.primaryUser;
    };
  };
  # nix-darwin configurations
  flake.darwinConfigurations = mkDarwinConfigurations {
    eR17 = { };
    eR17x = { };
  };
}
