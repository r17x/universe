{
  lib,
  stdenv,
  fetchurl,
  undmg,
  unzip,
}:

let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";

  pname = "obs-studio";

  version =
    rec {
      aarch64-darwin = "29.0.2";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  sha256 =
    rec {
      aarch64-darwin = "sha256-gJLdKUURT8AXwS0mcNl+elGKq0L0BfutJrwuInwaFWw=";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  srcs =
    let
      base = "https://cdn-fastly.obsproject.com/downloads";
    in
    rec {
      aarch64-darwin = {
        inherit sha256;
        url = "${base}/obs-studio-${version}-macos-arm64.dmg";
      };
      x86_64-darwin = aarch64-darwin // {
        url = "${base}/obs-studio-${version}-macos-x86_64.dmg";
      };
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Open Broadcaster Software";
    homepage = "https://obsproject.com/";
    license = licenses.mit;
    platforms = [
      "x86_64-darwin"
      "aarch64-darwin"
    ];
  };

  appname = "OBS";

  darwin = stdenv.mkDerivation {
    inherit
      pname
      version
      src
      meta
      ;

    nativeBuildInputs = [ undmg ];
    buildInputs = [ unzip ];
    unpackCmd = ''
      echo "File to unpack: $curSrc"
      if ! [[ "$curSrc" =~ \.dmg$ ]]; then return 1; fi
      mnt=$(mktemp -d -t ci-XXXXXXXXXX)

      function finish {
        echo "Detaching $mnt"
        /usr/bin/hdiutil detach $mnt -force
        rm -rf $mnt
      }
      trap finish EXIT

      echo "Attaching $mnt"
      /usr/bin/hdiutil attach -nobrowse -readonly $src -mountpoint $mnt

      echo "What's in the mount dir"?
      ls -la $mnt/

      echo "Copying contents"
      shopt -s extglob
      DEST="$PWD"
      (cd "$mnt"; cp -a !(Applications) "$DEST/")
    '';
    phases = [
      "unpackPhase"
      "installPhase"
    ];

    sourceRoot = "${appname}.app";

    installPhase = ''
      mkdir -p "$out/Applications/${appname}.app"
      cp -a ./. "$out/Applications/${appname}.app/"
    '';
  };
in
darwin
