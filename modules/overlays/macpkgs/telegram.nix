{ lib
, stdenv
, fetchurl
, undmg
,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "telegram-desktop";

  aarch64-darwin-version = "4.0.2";
  aarch64-darwin-sha256 = "sha256-Jr0jP15TQOJwWmo8Rbn2fGWMvMoSQTQ+Tl9e4HgFjBc=";

  version = {
    x86_64-darwin = aarch64-darwin-version;
    aarch64-darwin = aarch64-darwin-version;
  }.${system} or throwSystem;

  src =
    let
      base = "https://updates.tdesktop.com/tmac";
    in
      rec {
        aarch64-darwin = fetchurl {
          url = "${base}/tsetup.${version}.dmg";
          sha256 = aarch64-darwin-sha256;
        };
        x86_64-darwin = aarch64-darwin;
      }.${system} or throwSystem;

  meta = with lib; {
    description = "Telegram Desktop";
    homepage = "https://tdesktop.com/";
    license = licenses.gpl3Only;
    platforms = [ "x86_64-darwin" "aarch64-darwin" ];
  };

  darwin = stdenv.mkDerivation {
    inherit pname version src meta;

    nativeBuildInputs = [ undmg ];

    sourceRoot = "Telegram.app";

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications/Telegram.app
      cp -R . $out/Applications/Telegram.app
      runHook postInstall
    '';
  };
in
darwin

