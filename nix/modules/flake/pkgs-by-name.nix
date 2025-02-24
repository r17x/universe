{
  lib,
  flake-parts-lib,
  inputs,
  ...
}:
let
  inherit (flake-parts-lib)
    mkPerSystemOption
    ;
  inherit (lib)
    mkOption
    types
    ;
in
{
  options = {
    perSystem = mkPerSystemOption (
      { ... }:
      {
        options = {
          pkgsDirectory = mkOption {
            type = types.nullOr types.path;
            default = null;
            description = ''
              If set, the flake will import packages from the specified directory.
            '';
          };

          pkgsNameSeparator = mkOption {
            type = types.str;
            default = "/";
            description = ''
              The separator to use when flattening package names.
            '';
          };
        };
      }
    );
  };

  config = {
    perSystem =
      { config, pkgs, ... }:
      let
        flattenPkgs =
          separator: path: value:
          if lib.isDerivation value then
            {
              ${lib.concatStringsSep separator path} = value;
            }
          else
            lib.concatMapAttrs (name: flattenPkgs separator (path ++ [ name ])) value;

        scopeFromDirectory =
          directory:
          lib.makeScope pkgs.newScope (
            self:
            lib.filesystem.packagesFromDirectoryRecursive {
              inherit directory;
              callPackage = self.newScope { inherit inputs; };
            }
          );

        scope = scopeFromDirectory config.pkgsDirectory;

        # scope.packages is the second function we passed to makeScope. makeScope
        # calculates the fixpoint of the scope for us, ie. when we now call this
        # function with scope, scope.callPackage will "know" all locally defined
        # packages.
        # We don't have to worry about the performance of this function call, since
        # Nix is lazy and doesn't compute any equivalent expression more than once.
        legacyPackages = scope.packages scope;
      in
      lib.mkIf (config.pkgsDirectory != null) {
        inherit legacyPackages;
        packages = flattenPkgs config.pkgsNameSeparator [ ] legacyPackages;
      };
  };
}
