{
  denTest,
  den,
  inputs,
  ...
}:
{
  den.aspects.den-tests = {
    tests =
      { eR17, eR17x, ... }:
      {
        test-eR17-hostname = {
          expr = eR17.networking.hostName;
          expected = "eR17";
        };
        test-eR17x-hostname = {
          expr = eR17x.networking.hostName;
          expected = "eR17x";
        };
        test-eR17x-linux-builder = {
          expr = eR17x.nix.linux-builder.enable;
          expected = true;
        };
        test-eR17x-unbound = {
          expr = eR17x.services.unbound.enable;
          expected = true;
        };
        test-nixpkgs-overlays-exist = {
          expr = builtins.length inputs.self.nixpkgs.overlays > 0;
          expected = true;
        };
        test-colors-edge-exists = {
          expr = inputs.self.colors.lists ? edge;
          expected = true;
        };
        test-color-mkColor-is-function = {
          expr = builtins.isFunction inputs.self.colors.mkColor;
          expected = true;
        };
        test-icons-is-attrset = {
          expr = builtins.isAttrs inputs.self.icons;
          expected = true;
        };
      };
  };

  flake.tests.den-resolution = {
    test-flake-parts-resolution-is-module = denTest (
      { den, ... }:
      {
        expr = builtins.isAttrs (
          den.lib.aspects.resolve "flake-parts" (den.lib.resolveEntity "flake-parts" { })
        );
        expected = true;
      }
    );
    test-flake-resolution-is-module = denTest (
      { den, ... }:
      {
        expr = builtins.isAttrs (den.lib.aspects.resolve "flake" (den.lib.resolveEntity "flake" { }));
        expected = true;
      }
    );
  };

  flake.tests.den-guard-conditions = {
    test-guarded-include-fires-when-marker-present = denTest (
      { den, igloo, ... }:
      {
        den.hosts.x86_64-linux.igloo.users.tux = { };
        den.aspects.marker = { };
        den.aspects.igloo = {
          includes = [
            den.aspects.marker
            (den.lib.policy.when ({ host, ... }: host.hasAspect den.aspects.marker) {
              nixos = _: {
                networking.domain = "guard-passed";
              };
            })
          ];
        };
        expr = igloo.networking.domain;
        expected = "guard-passed";
      }
    );
    test-guarded-include-skipped-without-marker = denTest (
      { den, igloo, ... }:
      {
        den.hosts.x86_64-linux.igloo.users.tux = { };
        den.aspects.marker = { };
        den.aspects.igloo = {
          includes = [
            (den.lib.policy.when ({ host, ... }: host.hasAspect den.aspects.marker) {
              nixos = _: {
                networking.domain = "guard-passed";
              };
            })
          ];
        };
        expr = igloo.networking.domain;
        expected = null;
      }
    );
  };

  flake.tests.den-parametric = {
    test-parametric-fan-out-per-user = denTest (
      { den, igloo, ... }:
      {
        den.hosts.x86_64-linux.igloo.users.tux = { };
        den.aspects.per-user-shell =
          { user, ... }:
          {
            nixos = _: {
              users.users.${user.userName}.shell = "/bin/sh";
            };
          };
        den.aspects.igloo = {
          includes = [ den.aspects.per-user-shell ];
        };
        expr = igloo.users.users.tux.shell;
        expected = "/bin/sh";
      }
    );
    test-parametric-user-shape = denTest (
      { den, igloo, ... }:
      {
        den.schema.user.imports = [
          (
            { lib, ... }:
            {
              options.handle = lib.mkOption {
                type = lib.types.str;
              };
            }
          )
        ];
        den.hosts.x86_64-linux.igloo.users.tux = {
          handle = "tuxedo";
        };
        den.aspects.greeting =
          { user, ... }:
          {
            nixos = _: {
              networking.domain = user.handle;
            };
          };
        den.aspects.igloo = {
          includes = [ den.aspects.greeting ];
        };
        expr = igloo.networking.domain;
        expected = "tuxedo";
      }
    );
  };
}
