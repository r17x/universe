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
  '';

  sourceRoot = ".";

  installPhase = ''
    runHook preInstall

    mkdir -p $out/Applications
    cp -R Applications/* $out/Applications/

    if [ -d "Resources" ]; then
      mkdir -p $out/Resources
      cp -R Resources/* $out/Resources/
    fi

    if [ -d "Library" ]; then
      mkdir -p $out/Library
      cp -R Library/* $out/Library/
    fi

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
