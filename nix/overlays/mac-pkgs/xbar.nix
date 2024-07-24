{
  lib,
  stdenv,
  fetchurl,
  undmg,
  ...
}:

stdenv.mkDerivation rec {
  pname = "xbar";
  version = "2.1.7-beta";
  src = fetchurl {
    url = "https://github.com/matryer/xbar/releases/download/v${version}/xbar.v${version}.dmg";
    sha256 = "sha256-Cn6nxA5NTi7M4NrjycN3PUWd31r4Z0T3DES5+ZAbxz8=";
  };

  sourceRoot = "xbar.app";

  nativeBuildInputs = [ undmg ];

  installPhase = ''
    mkdir -p $out/Applications/xbar.app
    cp -R . $out/Applications/xbar.app
  '';

  meta = with lib; {
    description = "Put the output from any script or program into your macOS Menu Bar (the BitBar reboot)";
    homepage = "https://xbarapp.com/";
    sourceProvenance = with sourceTypes; [ binaryNativeCode ];
    platforms = platforms.darwin;
    maintainers = with maintainers; [ r17x ];
    license = licenses.mit;
  };
}
