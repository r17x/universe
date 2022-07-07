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

  x86_64-darwin-version = "27.2.4";
  x86_64-darwin-sha256 = "mu7ZKBbyP9tIGesbDJicFYqqskbgvQJJM0KWFLBkNfI=";

  aarch64-darwin-version = "27.2.4";
  aarch64-darwin-sha256 = "mu7ZKBbyP9tIGesbDJicFYqqskbgvQJJM0KWFLBkNfI=";

  version = {
    x86_64-darwin = x86_64-darwin-version;
    aarch64-darwin = aarch64-darwin-version;
  }.${system} or throwSystem;

  src =
    let
      base = "https://cdn-fastly.obsproject.com/downloads";
    in
      {
        x86_64-darwin = fetchurl {
          url = "${base}/obs-mac-${x86_64-darwin-version}.dmg";
          sha256 = x86_64-darwin-sha256;
        };
        aarch64-darwin = fetchurl {
          url = "${base}/obs-mac-${aarch64-darwin-version}.dmg";
          sha256 = aarch64-darwin-sha256;
        };
      }.${system} or throwSystem;

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

