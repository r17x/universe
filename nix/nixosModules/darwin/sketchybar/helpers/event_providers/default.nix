{ lib, stdenv, ... }:

stdenv.mkDerivation {
  name = "event_providers";
  src = lib.cleanSource ./.;

  installPhase = ''
    mkdir -p $out/bin
    cp cpu_load/bin/cpu_load $out/bin/sbar_cpu_load
    cp network_load/bin/network_load $out/bin/sbar_network_load
  '';
}
