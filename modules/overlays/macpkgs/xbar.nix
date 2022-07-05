{ 
 lib,
 stdenv,
 fetchurl,
 undmg,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "xbar";

  x86_64-darwin-version = "2.1.7-beta";
  x86_64-darwin-sha256 = "0gy73f8gkfa41kvl8rzqbbgrsi9xfz1wkqysw362wkjd1v2afzha";

  aarch64-darwin-version = "2.1.7-beta";
  aarch64-darwin-sha256 = "0gy73f8gkfa41kvl8rzqbbgrsi9xfz1wkqysw362wkjd1v2afzha";

  version = {
    x86_64-darwin = x86_64-darwin-version;
    aarch64-darwin =  aarch64-darwin-version;
  }.${system} or throwSystem;

    src = let
      base = "https://github.com/matryer/xbar/releases/download";
  in {
    x86_64-darwin = fetchurl {
      url = "${base}/v${version}/xbar.v${version}.dmg";
      sha256 = x86_64-darwin-sha256;
    };
    aarch64-darwin = fetchurl {
      url = "${base}/v${version}/xbar.v${version}.dmg";
      sha256 = aarch64-darwin-sha256;
    };
  }.${system} or throwSystem;

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

