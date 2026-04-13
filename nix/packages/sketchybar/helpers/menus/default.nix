{
  lib,
  stdenv,
  apple-sdk_15,
  ...
}:

stdenv.mkDerivation {
  name = "menus";
  src = lib.cleanSource ./.;

  buildInputs = [
    apple-sdk_15
  ];

  nativeBuildInputs = [
    apple-sdk_15.privateFrameworksHook
  ];

  installPhase = ''
    mkdir -p $out/bin
    cp bin/menus $out/bin/sbar_menus
  '';
}
