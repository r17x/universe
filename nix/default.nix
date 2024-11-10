{ self, inputs, ... }:

{
  imports = [
    ./nixosModules
    ./hosts
    ./home
    ./devShells.nix
    ./overlays
  ];

  perSystem =
    {
      lib,
      system,
      inputs',
      ...
    }:
    {
      process-compose."ai" = {
        imports = [
          inputs.services-flake.processComposeModules.default
        ];
        services.ollama.ollamaX.enable = true;
        services.ollama.ollamaX.dataDir = "$HOME/.process-compose/ai/data/ollamaX";
        services.ollama.ollamaX.models = [ "qwen2.5-coder" ];
      };

      formatter = inputs'.nixpkgs.legacyPackages.nixfmt-rfc-style;

      _module.args =
        let
          overlays = [
            inputs.ocaml-overlay.overlays.default
            inputs.nixd.overlays.default
          ] ++ lib.attrValues self.overlays;
        in
        rec {
          icons = import ./icons.nix;
          # the nix package manager configurations and settings.
          nix =
            import ./nix.nix {
              inherit lib inputs inputs';
              inherit (pkgs) stdenv;
            }
            // {
              package = branches.master.nix;
            };

          pkgs = import inputs.nixpkgs {
            inherit system;
            inherit (nixpkgs) config;
            inherit overlays;
          };

          # nixpkgs (channel) configuration (not the flake input)
          nixpkgs = {
            config = lib.mkForce {
              allowBroken = true;
              allowUnfree = true;
              tarball-ttl = 0;

              # Experimental options, disable if you don't know what you are doing!
              contentAddressedByDefault = false;
            };

            hostPlatform = system;

            overlays = lib.mkForce overlays;
          };

          /*
            One can access these nixpkgs branches like so:

            `branches.stable.mpd'
            `branches.master.linuxPackages_xanmod'
          */
          branches =
            let
              pkgsFrom =
                branch: system:
                import branch {
                  inherit system;
                  inherit (nixpkgs) config;
                };
            in
            {
              master = pkgsFrom inputs.nixpkgs-master system;
              stable = pkgsFrom inputs.nixpkgs-stable system;
              unstable = pkgsFrom inputs.nixpkgs-unstable system;
            };

          /*
            Extra arguments passed to the module system for:

            `nix-darwin`
            `NixOS`
            `home-manager`
            `nix-on-droid`
          */
          extraModuleArgs = {
            inherit
              inputs'
              system
              branches
              ;
            inputs = lib.mkForce inputs;
          };

          # NixOS and nix-darwin base environment.systemPackages
          basePackagesFor =
            pkgs:
            builtins.attrValues {
              inherit (pkgs)
                vim
                curl
                fd
                wget
                git
                ;

              home-manager = inputs'.home-manager.packages.home-manager.override {
                path = "${inputs.home-manager}";
              };
            };
        };
    };
}
