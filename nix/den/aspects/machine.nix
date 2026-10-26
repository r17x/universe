{ den, lib, ... }:
{
  den.aspects.eR17 = {
    includes = with den.aspects; [
      nix
      shell
      desktop
      identity
      packages
      mail
      git
      terminal
      secrets
      editor
    ];

    darwin =
      { config, inputs, ... }:
      {
        imports = [ inputs.determinate.darwinModules.default ];

        nixpkgs.hostPlatform = "aarch64-darwin";

        nix-settings = {
          enable = true;
          use = "full";
          inputs-to-registry = true;
        };

        networking.computerName = config.networking.hostName;
      };

    homeManager =
      {
        inputs,
        pkgs,
        ...
      }:
      {
        home = {
          packages = [
            inputs.self.packages.${pkgs.stdenv.system}.universe
            pkgs.claude-code
          ];
        };

      };

    tests =
      { eR17, ... }:
      {
        test-eR17-has-fish-shell = {
          expr = eR17.users.users.r17.shell.pname or null;
          expected = "fish";
        };
        test-eR17-has-aerospace = {
          expr = eR17.services.aerospace.enable;
          expected = true;
        };
        test-eR17-has-sketchybar = {
          expr = eR17.services.sketchybar.enable;
          expected = true;
        };
      };
  };

  den.aspects.eR17x = {
    includes = with den.aspects; [
      eR17
    ];

    darwin = _: {
      documentation.enable = false;

      services = {
        tailscale.enable = false;
      };
    };

    tests =
      { eR17x, ... }:
      {
        test-eR17x-has-dnscrypt = {
          expr = eR17x.services.dnscrypt-proxy.enable;
          expected = true;
        };
        test-eR17x-has-tailscale = {
          expr = eR17x.services.tailscale.enable;
          expected = false;
        };
      };
  };

  den.aspects.ATSGJP6QDN402 = {
    includes = with den.aspects; [
      eR17x
    ];

    darwin = _: {
      # Determinate Nix manages the daemon, so nix-darwin must not.
      nix.enable = lib.mkForce false;
      nix-settings.use = lib.mkForce "minimal";

      homebrew.enable = lib.mkForce false;

      # sketchybar replaces the native menu bar
      system.defaults.NSGlobalDomain._HIHideMenuBar = true;
      services.aerospace.settings.gaps.outer.top = lib.mkForce 50;
    };

    homeManager =
      { pkgs, ... }:
      {
        home.packages = [ pkgs.ghostty-bin ];
      };
  };
}
