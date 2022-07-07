{ lib
, stdenv
, fetchurl
, undmg
, makeWrapper
, xar
, cpio
,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "iriun-webcam";

  sha256 = rec {
    aarch64-darwin = "sha256-1tT1sKe1zEQqORW7IcJPYXwGD/wRDG4VVBxkD5D9CNc=";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  version = rec {
    aarch64-darwin = "2.7.3";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  src =
    let
      base = "https://1758658189.rsc.cdn77.org";
    in
      rec {
        aarch64-darwin = fetchurl {
          url = "${base}/IriunWebcam-${version}.pkg";
          sha256 = sha256;
        };

        x86_64-darwin = aarch64-darwin;
      }.${system} or throwSystem;

  meta = with lib; {
    description = "Use your phone's camera as a wireless webcam in your PC or Mac.";
    homepage = "https://iriun.com";
    license = licenses.unfree;
    platforms = [ "x86_64-darwin" "aarch64-darwin" ];
  };

  darwin = stdenv.mkDerivation {
    inherit pname version src meta;

    nativeBuildInputs = [ makeWrapper xar cpio ];

    unpackPhase = lib.optionalString stdenv.isDarwin ''
      xar -xf $src
      zcat < webcam.pkg/Payload | cpio -i
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications
      cp -R ./Applications/IriunWebcam.app $out/Applications/
      runHook postInstall
    '';
  };

in
darwin
