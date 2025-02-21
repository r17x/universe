{
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

    ./flakeModules/module-config.nix
    {
      modulesGen.flakeModules.dir = ./flakeModules;
      modulesGen.crossModules.dir = ./crossModules;
    }

    ./flakeModules/rebuild-script.nix
    {
      rebuild-scripts.enable = true;
    }

  ];

  flake = {
    users.r17 = rec {
      username = "r17x";
      gh.url = "https://github.com/${username}";
      keys = [
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKvi3Co5fB1dSU2Qs1sR6LwdB1hM6HCyIWfXsC0wgz1pmeFlje24SzPCxDtsVMq28fDpEBsXPqKSZbUIyBtHRnpIc72Z8IV0KNtBjbKQTfHLTiDu43e+VLuAdFE7u2Wf5KPQIQ52r/jr9P7UKU2GKwV016OzrRiaZjm+gixmd8YRfidzG1bsL5fbKBjxCIUROdVpW5kNNtPZHpeuHCkZ7341USC6V2qnp1BNHIoHLjRYosV82apOxN/AWY/tMN2jlVQ/gKIUHbxXoILsG+XRFCen5TSSearx54KxifI1aIWbxVVmmYNuLXGWnVumaH6U7ARpz2cEXQB9z2lvJGYmod8qfloVdjXESu8OFe4RT+nj0JUQs7pMhiN6K1AsMQiyFc0ZmU2UNx4JcHre5STnSKUHUCx4zzoToFvIQRBTB3HePHy74FcXWaYDAN/6YF3JEA203nyYL4o5m/KhSXNkcT3H+r3IAqKnl7J7obsvNowwa1UB2NxVmq0VXXR8uZlT0="
      ];
    };

    # --- shareable nixpkgs configurations
    nixpkgs = {
      config = {
        allowBroken = true;
        allowUnfree = true;
        tarball-ttl = 0;
        contentAddressedByDefault = false;
      };

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
        crossModules
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
