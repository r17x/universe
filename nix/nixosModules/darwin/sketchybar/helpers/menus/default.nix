{ lib, stdenv, darwin, ... }:

stdenv.mkDerivation {
  name = "menus";
  src = lib.cleanSource ./.;

  buildInputs = with darwin.apple_sdk.frameworks; [ Carbon SkyLight ];

  installPhase = ''
    mkdir -p $out/bin
    cp bin/menus $out/bin/sbar_menus
  '';
}

