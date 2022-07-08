{ lib
, stdenv
, fetchurl
, undmg
,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "rectangle";

  version = rec {
    aarch64-darwin = "0.57";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  sha256 = rec {
    aarch64-darwin = "0pxk76q07m85j5sjf6z1zpqkjxqppr4acwwaj3xjh1k0pp2gdwnb";
    x86_64-darwin = aarch64-darwin;
  }.${system} or throwSystem;

  srcs =
    let
      base = "https://github.com/rxhanson/Rectangle/releases/download";
    in
    rec {
      aarch64-darwin = {
        url = "${base}/v${version}/Rectangle${version}.dmg";
        sha256 = sha256;
      };
      x86_64-darwin = aarch64-darwin;
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Move and resize windows on macOS with keyboard shortcuts and snap areas";
    homepage = "https://rectangleapp.com/";
    license = licenses.mit;
    platforms = [ "x86_64-darwin" "aarch64-darwin" ];
  };

  darwin = stdenv.mkDerivation {
    inherit pname version src meta;

    nativeBuildInputs = [ undmg ];

    sourceRoot = "Rectangle.app";

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications/Rectangle.app
      cp -R . $out/Applications/Rectangle.app
      runHook postInstall
    '';
  };
in
darwin
