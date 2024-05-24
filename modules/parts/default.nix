{ self, inputs, ... }:

{
  imports = [ ];

  perSystem = { lib, system, inputs', ... }: {
    formatter = inputs.nixpkgs-fmt.defaultPackage.${system};

    _module.args = rec {
      # the nix package manager configurations and settings.
      nix = import ./nix.nix
        {
          inherit lib inputs inputs';
          inherit (pkgs) stdenv;
        } // {
        package = pkgs.nix;
      };

      pkgs = import inputs.nixpkgs {
        inherit system;
        inherit (nixpkgs) config;
        overlays = [ self.overlays.default ];
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

        overlays = lib.mkForce [ self.overlays.default ];
      };

      # Extra arguments passed to the module system for nix-darwin, NixOS, and home-manager
      extraModuleArgs = {
        inherit inputs' system;
        inputs = lib.mkForce inputs;

        /*
          One can access these nixpkgs branches like so:

          `branches.stable.mpd'
          `branches.master.linuxPackages_xanmod'
        */
        branches =
          let
            pkgsFrom = branch: system: import branch {
              inherit system;
              inherit (nixpkgs) config overlays;
            };
          in
          {
            master = pkgsFrom inputs.master system;
            stable = pkgsFrom inputs.stable system;
            unstable = pkgsFrom inputs.unstable system;
          };
      };

      # NixOS and nix-darwin base environment.systemPackages
      basePackagesFor = pkgs: builtins.attrValues {
        inherit (pkgs)
          vim
          curl
          fd
          wget
          git;

        home-manager = inputs'.home.packages.home-manager.override { path = "${inputs.home}"; };
      };
    };
  };
}
