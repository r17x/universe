{ denTest, den, ... }:
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
    test-builder-in-eR17x = denTest (
      { den, igloo, ... }:
      {
        den.hosts.x86_64-linux.igloo.users.tux = { };
        den.aspects.igloo = {
          includes = [ den.aspects.has-builder ];
        };
        den.aspects.has-builder = {
          nixos = _: {
            networking.domain = "builder-enabled";
          };
        };
        expr = igloo.networking.domain;
        expected = "builder-enabled";
      }
    );
    test-aspect-without-include-has-no-extra = denTest (
      { den, igloo, ... }:
      {
        den.hosts.x86_64-linux.igloo.users.tux = { };
        den.aspects.igloo = { };
        den.aspects.unused = {
          nixos = _: {
            networking.domain = "should-not-appear";
          };
        };
        expr = igloo.networking.domain;
        expected = null;
      }
    );
  };

  flake.tests.den-parametric = {
    test-parametric-reserved-for-future = denTest (_: {
      expr = true;
      expected = true;
    });
  };
}
