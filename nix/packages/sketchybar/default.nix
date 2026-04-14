{
  lua54Packages,
  lib,
  writeText,
  sketchybarColors ? null,
  ...
}:

let
  inherit (lua54Packages) lua buildLuaPackage;
  inherit (import ../../colors.nix { inherit lib; }) toArgb;

  solid = toArgb 1.0;

  mkColors =
    {
      black,
      white,
      red,
      green,
      blue,
      yellow,
      orange,
      magenta,
      grey,
      barBg,
      popupBg,
      popupBorder,
      bg1,
      bg2,
      bg3,
      ...
    }:
    {
      black = solid black;
      white = solid white;
      red = solid red;
      green = solid green;
      blue = solid blue;
      yellow = solid yellow;
      orange = solid orange;
      magenta = solid magenta;
      grey = solid grey;
      bar = {
        bg = toArgb (240.0 / 255) barBg;
        border = solid barBg;
      };
      popup = {
        bg = toArgb (192.0 / 255) popupBg;
        border = solid popupBorder;
      };
      bg1 = solid bg1;
      bg2 = solid bg2;
      bg3 = solid bg3;
    };

  # Edge-family palette (sonokai variant) — raw "#RRGGBB" values
  defaultPalette = {
    black = "#181819";
    white = "#e2e2e3";
    red = "#fc5d7c";
    green = "#9ed072";
    blue = "#76cce0";
    yellow = "#e7c664";
    orange = "#f39660";
    magenta = "#b39df3";
    grey = "#7f8490";
    barBg = "#2c2e34";
    barBorder = "#2c2e34";
    popupBg = "#2c2e34";
    popupBorder = "#7f8490";
    bg1 = "#363944";
    bg2 = "#414550";
    bg3 = "#4c4f5a";
  };

  defaultColors = mkColors defaultPalette;

  c = if sketchybarColors != null then sketchybarColors else defaultColors;

  generatedColorsLua = writeText "colors.lua" ''
    local colors = {
    	black = ${c.black},
    	white = ${c.white},
    	red = ${c.red},
    	green = ${c.green},
    	blue = ${c.blue},
    	yellow = ${c.yellow},
    	orange = ${c.orange},
    	magenta = ${c.magenta},
    	grey = ${c.grey},
    	transparent = 0x00000000,

    	bar = {
    		bg = ${c.bar.bg},
    		border = ${c.bar.border},
    	},

    	popup = {
    		bg = ${c.popup.bg},
    		border = ${c.popup.border},
    	},

    	bg1 = ${c.bg1},
    	bg2 = ${c.bg2},
    	bg3 = ${c.bg3},

    	with_alpha = function(color, alpha)
    		if alpha > 1.0 or alpha < 0.0 then
    			return color
    		end
    		return (color & 0x00ffffff) | (math.floor(alpha * 255.0) << 24)
    	end,
    }

    colors.bg0 = colors.transparent

    return colors
  '';
in

buildLuaPackage {
  name = "sketchybar-config";
  pname = "sketchybar-config";
  version = "0.0.0";
  src = lib.cleanSourceWith {
    src = ./.;
    filter =
      path: type: (type == "directory" || lib.hasSuffix ".lua" path) && baseNameOf path != "colors.lua";
  };
  buildPhase = ":";
  installPhase = # bash
    ''
      mkdir -p "$out/share/lua/${lua.luaversion}"
      cp -r $src/* "$out/share/lua/${lua.luaversion}/"
      cp ${generatedColorsLua} "$out/share/lua/${lua.luaversion}/colors.lua"
    '';

  passthru = {
    inherit defaultPalette defaultColors mkColors;
  };
}
