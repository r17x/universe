{ lib
, stdenv
, fetchurl
, undmg
,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "xbar";

  version = rec {
    aarch64-darwin = "2.1.7-beta";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  sha256 = rec {
    aarch64-darwin = "0gy73f8gkfa41kvl8rzqbbgrsi9xfz1wkqysw362wkjd1v2afzha";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  srcs =
    let
      base = "https://github.com/matryer/xbar/releases/download";
    in
    rec {
      aarch64-darwin = {
        url = "${base}/v${version}/xbar.v${version}.dmg";
        sha256 = sha256;
      };
      x86_64-darwin = aarch64-darwin;
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Move and resize windows on macOS with keyboard shortcuts and snap areas";
    homepage = "https://xbarapp.com/";
    license = licenses.mit;
    platforms = [ "x86_64-darwin" "aarch64-darwin" ];
  };

  darwin = stdenv.mkDerivation {
    inherit pname version src meta;

    nativeBuildInputs = [ undmg ];

    sourceRoot = "xbar.app";

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications/xbar.app
      cp -R . $out/Applications/xbar.app
      runHook postInstall
    '';
  };
in
darwin

