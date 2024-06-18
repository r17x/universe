{ lua54Packages, gcc, darwin, fetchFromGitHub, readline, ... }:

let inherit (lua54Packages) buildLuaPackage; in

buildLuaPackage {
  name = "sbarlua";
  pname = "sbarlua";
  version = "0.0.0";

  src = fetchFromGitHub {
    owner = "FelixKratz";
    repo = "SbarLua";
    rev = "29395b1928835efa1b376d438216fbf39e0d0f83";
    sha256 = "sha256-C2tg1mypz/CdUmRJ4vloPckYfZrwHxc4v8hsEow4RZs=";
  };

  buildInputs = [ gcc darwin.apple_sdk.frameworks.CoreFoundation readline ];

  installPhase = ''
    mkdir -p $out/lib
    cp bin/sketchybar.so $out/lib
  '';
}
