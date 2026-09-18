{
  lua54Packages,
  lib,
  writeText,
  sketchybarColors ? null,
  sketchybarStyle ? null,
  ...
}:

let
  inherit (lua54Packages) lua buildLuaPackage;
  colorsLib = import ../../colors.nix { inherit lib; };
  inherit (colorsLib) toArgb;

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

  defaultPalette = colorsLib.semanticPalettes.edge;

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

  hairlineLayout = {
    bar = {
      height = 30;
      padding = 10;
    };
    font = {
      icon = {
        style = "Regular";
        size = 11.0;
      };
      label = {
        family = "numbers";
        style = "Regular";
        size = 11.0;
      };
    };
    background = {
      height = 20;
      corner_radius = 6;
      border_width = 0;
    };
    popup = {
      border_width = 1;
      corner_radius = 6;
    };
    spaces = {
      icon_padding = {
        left = 6;
        right = 5;
      };
      label_padding_right = 6;
      bg_height = 20;
      border_width = 0;
      bracket_border_width = 0;
      focused = {
        bg_height = 22;
        icon_padding = {
          left = 8;
          right = 6;
        };
        label_padding_right = 8;
      };
    };
  };

  profiles = {
    default = {
      bar = {
        height = 40;
        padding = 2;
      };
      font = {
        icon = {
          style = "Bold";
          size = 14.0;
        };
        label = {
          family = "text";
          style = "Semibold";
          size = 13.0;
        };
      };
      background = {
        height = 28;
        corner_radius = 9;
        border_width = 2;
      };
      popup = {
        border_width = 2;
        corner_radius = 9;
      };
      color_keys = {
        icon = "white";
        label = "white";
        icon_highlight = "red";
        label_highlight = "white";
        bg_border = "bg2";
        space_bg = "bg1";
        space_border = "black";
        bracket_border = "bg2";
        focused_bg = "bg1";
        focused_border = "black";
      };
      spaces = {
        icon_padding = {
          left = 15;
          right = 8;
        };
        label_padding_right = 20;
        bg_height = 26;
        border_width = 1;
        bracket_border_width = 2;
        focused = {
          bg_height = 28;
          icon_padding = {
            left = 15;
            right = 8;
          };
          label_padding_right = 20;
        };
      };
    };

    hairline = hairlineLayout // {
      color_keys = {
        icon = "grey";
        label = "grey";
        icon_highlight = "white";
        label_highlight = "grey";
        bg_border = "transparent";
        space_bg = "transparent";
        space_border = "transparent";
        bracket_border = "transparent";
        focused_bg = "bg1";
        focused_border = "transparent";
      };
    };

    hairline-color = hairlineLayout // {
      color_keys = {
        icon = "white";
        label = "white";
        icon_highlight = "red";
        label_highlight = "white";
        bg_border = "transparent";
        space_bg = "bg1";
        space_border = "transparent";
        bracket_border = "transparent";
        focused_bg = "bg1";
        focused_border = "transparent";
      };
    };
  };

  luaSerialize =
    let
      serializeValue =
        v:
        if builtins.isAttrs v then
          serializeAttrs v
        else if builtins.isInt v then
          toString v
        else if builtins.isFloat v then
          toString v
        else if builtins.isString v then
          ''"${v}"''
        else if builtins.isBool v then
          if v then "true" else "false"
        else
          throw "luaSerialize: unsupported type";
      serializeAttrs =
        attrs:
        let
          entries = lib.mapAttrsToList (
            k: v:
            let
              key = if builtins.match "[a-zA-Z_][a-zA-Z0-9_]*" k != null then k else ''["${k}"]'';
            in
            "${key} = ${serializeValue v}"
          ) attrs;
        in
        "{ ${lib.concatStringsSep ", " entries} }";
    in
    serializeAttrs;

  activeProfile = if sketchybarStyle != null then sketchybarStyle else profiles.default;

  generatedStyleLua = writeText "style.lua" ''
    return ${luaSerialize activeProfile}
  '';
in

buildLuaPackage {
  name = "sketchybar-config";
  pname = "sketchybar-config";
  version = "0.0.0";
  src = lib.cleanSourceWith {
    src = ./.;
    filter =
      path: type:
      (type == "directory" || lib.hasSuffix ".lua" path)
      && baseNameOf path != "colors.lua"
      && baseNameOf path != "style.lua";
  };
  buildPhase = ":";
  installPhase = # bash
    ''
      mkdir -p "$out/share/lua/${lua.luaversion}"
      cp -r $src/* "$out/share/lua/${lua.luaversion}/"
      cp ${generatedColorsLua} "$out/share/lua/${lua.luaversion}/colors.lua"
      cp ${generatedStyleLua} "$out/share/lua/${lua.luaversion}/style.lua"
    '';

  passthru = {
    inherit
      profiles
      defaultPalette
      defaultColors
      mkColors
      ;
  };
}
