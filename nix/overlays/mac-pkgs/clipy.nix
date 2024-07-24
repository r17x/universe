{
  lib,
  stdenv,
  fetchurl,
  undmg,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "clipy";

  version =
    rec {
      aarch64-darwin = "1.2.1";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  sha256 =
    rec {
      aarch64-darwin = "sha256-37tmzjE1+6otZOruqZpj5jSF4yLJdGBFoQmLFpah7NU=";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  srcs =
    let
      base = "https://github.com/Clipy/Clipy/releases/download/";
    in
    rec {
      aarch64-darwin = {
        url = "${base}/${version}/Clipy_${version}.dmg";
        sha256 = sha256;
      };
      x86_64-darwin = aarch64-darwin;
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Clipboard app extensions for macOS";
    homepage = "https://clipy-app.com/";
    license = licenses.mit;
    platforms = [
      "x86_64-darwin"
      "aarch64-darwin"
    ];
  };

  darwin = stdenv.mkDerivation {
    inherit
      pname
      version
      src
      meta
      ;

    nativeBuildInputs = [ undmg ];

    sourceRoot = "Clipy.app";

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications/Clipy.app
      cp -R . $out/Applications/Clipy.app
      runHook postInstall
    '';
  };
in
darwin
