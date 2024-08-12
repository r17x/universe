{
  lib,
  stdenvNoCC,
  fetchurl,
  cpio,
  xar,
  undmg,
  ...
}:

stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "sf-symbols";
  version = "5.1";

  src = fetchurl {
    url = "https://devimages-cdn.apple.com/design/resources/download/SF-Symbols-${finalAttrs.version}.dmg";
    sha256 = "sha256-7HIOlAYpQHzyoMhW2Jtwq2Tor8ojs4mTHjUjfMKKMM4=";
  };

  nativeBuildInputs = [
    cpio
    xar
    undmg
  ];

  unpackPhase = ''
    undmg $src
    xar -xf SF\ Symbols.pkg
    cd SFSymbols.pkg
    zcat Payload | cpio -id
    cd ..
  '';

  sourceRoot = ".";

  postPatch = ''
    for f in *.pkg/Library/Launch{Agents,Daemons}/*.plist; do
      substituteInPlace $f \
        --replace "/Library/" "$out/Library/"
    done
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/Applications
    cp -R SFSymbols.pkg/Applications/* $out/Applications/

    if [ -d "SFSymbols.pkg/Resources" ]; then
      mkdir -p $out/Resources
      cp -R SFSymbols.pkg/Resources/* $out/Resources/
    fi

    if [ -d "SFSymbols.pkg/Library" ]; then
      mkdir -p $out/Library
      cp -R SFSymbols.pkg/Library/* $out/Library/
    fi

    mkdir -p $out/share/fonts
    cp -a SFSymbols.pkg/Library/Fonts/* $out/share/fonts/

    runHook postInstall
  '';

  meta = with lib; {
    description = "Tool that provides consistent, highly configurable symbols for apps";
    homepage = "https://developer.apple.com/design/human-interface-guidelines/sf-symbols";
    sourceProvenance = with sourceTypes; [ binaryNativeCode ];
    platforms = platforms.darwin;
    maintainers = with maintainers; [ r17x ];
    license = licenses.mit;
  };
})
