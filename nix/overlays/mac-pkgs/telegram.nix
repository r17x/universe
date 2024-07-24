{
  lib,
  stdenv,
  fetchurl,
  undmg,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "telegram";

  # see version history https://desktop.telegram.org/changelog
  version =
    rec {
      aarch64-darwin = "4.11.6";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  sha256 =
    rec {
      aarch64-darwin = "sha256-g6Cm3bMq8nVPf2On94yNYmKdfnCyxaEsnVbsJYBaVZs";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  srcs =
    let
      base = "https://updates.tdesktop.com/tmac";
    in
    rec {
      aarch64-darwin = {
        url = "${base}/tsetup.${version}.dmg";
        sha256 = sha256;
      };
      x86_64-darwin = aarch64-darwin;
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Telegram Desktop";
    homepage = "https://tdesktop.com/";
    license = licenses.gpl3Only;
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
