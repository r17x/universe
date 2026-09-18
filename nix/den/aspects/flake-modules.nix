{ ... }:
{
  imports = [
    ../../modules/flake/rebuild-script.nix
    { rebuild-scripts.enable = true; }
    ../../modules/flake/universe.nix
    ../../modules/flake/pkgs-by-name.nix
    {
      perSystem.pkgsDirectory = ../../packages;
      perSystem.pkgsNameSeparator = ".";
    }
  ];

  den.aspects.flake-modules = { };
}
