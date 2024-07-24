{
  lib,
  stdenv,
  fetchurl,
  undmg,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "googlechrome";

  version =
    rec {
      aarch64-darwin = "stable";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  sha256 =
    rec {
      aarch64-darwin = "sha256-EAq63uwfTB+5bPvnN/u1/9rEVrtFmLhOOgZYxknkMPs=";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  srcs =
    let
      base = "https://dl.google.com/chrome/mac/universal/";
    in
    rec {
      aarch64-darwin = {
        url = "${base}/${version}/GGRO/googlechrome.dmg";
        sha256 = sha256;
      };
      x86_64-darwin = aarch64-darwin;
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Browse the internet citizen";
    homepage = "https://google.com/";
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

    sourceRoot = "Google\ Chrome.app";

    installPhase = ''
      runHook preInstall
      mkdir -p $out/Applications/Google\ Chrome.app
      cp -R . $out/Applications/Google\ Chrome.app
      runHook postInstall
    '';
  };
in
darwin
