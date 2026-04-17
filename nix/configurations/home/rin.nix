{ pkgs, ... }:
{
  imports = [
    ./r17.nix
  ];

  home = {
    username = "rin";
    packages = [
      pkgs.ghostty-bin
    ];
  };
}
