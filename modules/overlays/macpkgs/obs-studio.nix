{ lib
, stdenv
, fetchurl
, undmg
,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "obs-studio";

  version = rec {
    aarch64-darwin = "27.2.4";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  sha256 = rec {
    aarch64-darwin = "mu7ZKBbyP9tIGesbDJicFYqqskbgvQJJM0KWFLBkNfI=";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  srcs =
    let
      base = "https://cdn-fastly.obsproject.com/downloads";
    in
    rec {
      aarch64-darwin = {
        url = "${base}/obs-mac-${version}.dmg";
        sha256 = sha256;
      };
      x86_64-darwin = aarch64-darwin;
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Open Broadcaster Software";
    homepage = "https://obsproject.com/";
    license = licenses.mit;
    platforms = [ "x86_64-darwin" "aarch64-darwin" ];
  };

  darwin = stdenv.mkDerivation {
    inherit pname version src meta;

    nativeBuildInputs = [ undmg ];

    sourceRoot = "OBS.app";

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications/OBS.app
      cp -R . $out/Applications/OBS.app
      runHook postInstall
    '';
  };
in
darwin
