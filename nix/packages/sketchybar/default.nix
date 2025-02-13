{ lua54Packages, lib, ... }:

let
  inherit (lua54Packages) lua buildLuaPackage;
in

buildLuaPackage {
  name = "sketchybar-config";
  pname = "sketchybar-config";
  version = "0.0.0";
  src = lib.cleanSource ./.;
  buildPhase = ":";
  installPhase = # bash
    ''
      mkdir -p "$out/share/lua/${lua.luaversion}"
      cp -r $src/* "$out/share/lua/${lua.luaversion}/"
    '';
}
