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

  pname = "orbstack";

  version =
    rec {
      aarch64-darwin = "0.10.0_1407";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  sha256 =
    rec {
      aarch64-darwin = "sha256-pHFlsmKam9u/8rb5P6fVkPSI9qHQKxvYsvXpqaJ/TB8=";
      x86_64-darwin = aarch64-darwin;
    }
    .${system} or throwSystem;

  srcs =
    let
      base = "https://cdn-updates.orbstack.dev";
    in
    rec {
      aarch64-darwin = {
        inherit sha256;
        url = "${base}/arm64/OrbStack_v${version}_arm64.dmg";
      };
      x86_64-darwin = aarch64-darwin // {
        url = "TODO";
      };
    };

  src = fetchurl (srcs.${system} or throwSystem);

  meta = with lib; {
    description = "Run Docker and Linux on your Mac seamlessly and efficiently.";
    homepage = "https://orbstack.dev/";
    platforms = [ "aarch64-darwin" ];
  };

  appname = "OrbStack";

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
