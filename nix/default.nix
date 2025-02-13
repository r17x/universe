{
  self,
  lib,
  inputs,
  ...
}:

{

  imports = [
    inputs.process-compose-flake.flakeModule
    inputs.ez-configs.flakeModule

    ./devShells.nix
    ./overlays
    ./nvim.nix
  ];

  flake = {
    nixpkgs = {
      config.allowBroken = true;
      config.allowUnfree = true;
      config.tarball-ttl = 0;
      config.contentAddressedByDefault = false;
      overlays = lib.attrValues inputs.self.overlays ++ [
        inputs.ocaml-overlay.overlays.default
      ];
    };
    icons = import ./icons.nix;
    colors = import ./colors.nix { inherit lib; };
    color = inputs.self.colors.mkColor inputs.self.colors.lists.edge;
  };

  ezConfigs = {
    root = ./.;
    globalArgs = {
      inherit inputs;
      inherit (inputs.self)
        icons
        colors
        color
        ;
    };

    home.modulesDirectory = ./homeModules;
    home.configurationsDirectory = ./homeConfigurations;

    darwin.modulesDirectory = ./darwinModules;
    darwin.configurationsDirectory = ./darwinConfigurations;
    darwin.hosts = {
      eR17.userHomeModules = [ "r17" ];
      eR17x.userHomeModules = [ "r17" ];
    };
    nixos.modulesDirectory = ./nixosModules;
    nixos.configurationsDirectory = ./nixosConfigurations;
  };

  perSystem =
    {
      system,
      inputs',
      ...
    }:
    {
      formatter = inputs'.nixpkgs.legacyPackages.nixfmt-rfc-style;

      process-compose."ai" = {
        imports = [
          inputs.services-flake.processComposeModules.default
        ];
        services.ollama.ollamaX.enable = true;
        services.ollama.ollamaX.dataDir = "$HOME/.process-compose/ai/data/ollamaX";
        services.ollama.ollamaX.models = [
          "qwen2.5-coder"
          "deepseek-r1:1.5b"
        ];
      };

      _module.args = {
        inherit (inputs.self) icons colors color;
        extraModuleArgs = {
          inherit (inputs.self) icons colors color;
        };
        pkgs = import inputs.nixpkgs {
          inherit system;
          inherit (inputs.self.nixpkgs) config overlays;
        };
      };
    };
}
