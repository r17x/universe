/**
  In this module used for define module based on directory files (recursively)

  examples

  in your flake config repository:
  /nix/flakeModules/a.nix
  /nix/flakeModules/b.nix

  ```nix
  imports = [
    inputs.r17x.flakeModules.modules-config
    {
      moduleConfig.flakeModules.dir = ./nix/flakeModules;
    }
  ];
  ```
  it will be make you `flakeModules = { a = ./nix/flakeModules/a.nix; b = ./nix/flakeModules/b.nix; }`
*/

top@{ lib, ... }:

let
  # Define the option type for a directory path
  dirOptionType = lib.types.submodule {
    options.dir = lib.mkOption {
      type = lib.types.path;
      description = "The directory containing Nix modules to be imported.";
    };
  };

  inherit (top.config) modulesGen;

  isEnabled = lib.isAttrs modulesGen;

  # Stolen from: https://github.com/ehllie/ez-configs/blob/main/flake-module.nix#L162
  readModules =
    dir:
    let
      inherit (builtins)
        pathExists
        readDir
        readFileType
        ;
    in
    if pathExists "${dir}.nix" && readFileType "${dir}.nix" == "regular" then
      { default = dir; }
    else if pathExists dir && readFileType dir == "directory" then
      lib.concatMapAttrs (
        entry: type:
        let
          dirDefault = "${dir}/${entry}/default.nix";
        in
        if type == "regular" && lib.strings.hasSuffix ".nix" entry then
          { ${lib.strings.removeSuffix ".nix" entry} = "${dir}/${entry}"; }
        else if pathExists dirDefault && readFileType dirDefault == "regular" then
          { ${entry} = dirDefault; }
        else
          { }
      ) (readDir dir)
    else
      { };

  attrsToModules = name: value: lib.attrsets.nameValuePair "${name}" (readModules value.dir);

in

{
  options.modulesGen = lib.mkOption {
    type = lib.types.attrsOf dirOptionType;
    default = null;
    description = "The directory containing Nix modules to be imported.";
  };

  config = lib.mkIf isEnabled { flake = (lib.attrsets.mapAttrs' attrsToModules modulesGen); };
}
