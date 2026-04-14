/**
  The standard color naming convention used in the Base16 or Base8 color schemes.

  The Base16 system is designed to create harmonious themes for terminal applications,
  text editors, and other interfaces.

  Base00: Background color (default).
  Base01: Lowlight (darker than the selection background).
  Base02: Selection Background.
  Base03: Bright Background (used for emphasis).
  Base04: Dark Foreground (slightly brighter than Base05).
  Base05: Foreground (default text).
  Base06: Light Foreground (almost white text for highlights).
  Base07: Light Background (brighter than Base00).
  Base08: Red (used for errors or attention-grabbing).
  Base09: Bright Red (alternative for orange tones).
  Base0A: Yellow (used for warnings).
  Base0B: Green (used for success or hints).
  Base0C: Cyan (used for secondary highlights).
  Base0D: Blue (used for information or primary focus).
  Base0E: Magenta (used for accent or special elements).
  Base0F: Bright Cyan (extra color, often brown or special-purpose).
*/

{ lib }:

let
  decToHex = lib.toHexString;

  # "#RRGGBB" -> "RRGGBB"
  stripHash = lib.removePrefix "#";

  # "#RRGGBB" -> "0xffrrggbb" (alpha 0.0-1.0, default 1.0)
  toArgb =
    alpha: hex:
    let
      a = decToHex (builtins.floor (alpha * 255 + 0.5));
      alphaHex = if builtins.stringLength a < 2 then "0${a}" else a;
    in
    "0x${lib.toLower alphaHex}${lib.toLower (stripHash hex)}";

  KV = {
    string = a: b: "${toString a}=${b}";
    scheme = a: b: {
      name = "base${if a < 16 then "0${decToHex a}" else decToHex a}";
      value = b;
    };
  };

  toScheme = (lib.flip lib.pipe) [
    (lib.lists.imap0 KV.scheme)
    lib.attrsets.listToAttrs
  ];

  toKVString = lib.lists.imap0 KV.string;

  mkColor = xs: {
    # { base00 = "#2B2D3A"; ... }
    scheme = toScheme xs;
    # { base00 = "2B2D3A"; ... }
    raw = lib.mapAttrs (_: stripHash) (toScheme xs);
    # [ "0=#2B2D3A" ... ]
    listKV = toKVString xs;
    # "#RRGGBB" -> "0xAARRGGBB"
    withAlpha = toArgb;
  };

in
{
  inherit
    KV
    decToHex
    stripHash
    toArgb
    toScheme
    toKVString
    mkColor
    ;

  lists = {
    /**
      This is inspired by Edge Dark Neon
      https://github.com/sainnhe/edge?tab=readme-ov-file#%F0%9D%90%84%F0%9D%90%9D%F0%9D%90%A0%F0%9D%90%9E-%F0%9D%90%83%F0%9D%90%9A%F0%9D%90%AB%F0%9D%90%A4-%F0%9D%90%8D%F0%9D%90%9E%F0%9D%90%A8%F0%9D%90%A7
    */
    edge = [
      "#2B2D3A" # base00: Background
      "#EC7279" # base08: Red
      "#A0C980" # base0B: Green
      "#EF9F76" # base0A: Yellow
      "#6CB6EB" # base0D: Blue
      "#D38AEA" # base0E: Magenta
      "#5DBBC1" # base0C: Cyan
      "#E1E5ED" # base05: Foreground
      "#3D3D40" # base03: Bright Background
      "#F17E84" # base09: Bright Red
      "#B1D48B" # base01: Lowlight
      "#F5B083" # base02: Selection Background
      "#7EC1F5" # base04: Dark Foreground
      "#DE95F5" # base06: Light Foreground
      "#68C7CD" # base0F: Bright Cyan
      "#F0F4FA" # base07: Light Background
    ];

    zenwritten_dark = [
      "#191919"
      "#de6e7c"
      "#819b69"
      "#b77e64"
      "#6099c0"
      "#b279a7"
      "#66a5ad"
      "#bbbbbb"
      "#3d3839"
      "#e8838f"
      "#8bae68"
      "#d68c67"
      "#61abda"
      "#cf86c1"
      "#65b8c1"
      "#8e8e8e"
    ];

    # HUD palettes — dark industrial base with chromatic accent variants

    hud-neon = [
      "#1A1A1E" # base00: Background
      "#FF5F6A" # base01: Red (neon)
      "#50FA7B" # base02: Green (electric)
      "#F1FA8C" # base03: Yellow (bright)
      "#61AFEF" # base04: Blue (vivid)
      "#FF79C6" # base05: Magenta (hot pink)
      "#8BE9FD" # base06: Cyan (electric)
      "#F8F8F2" # base07: Foreground
      "#2A2A2E" # base08: Bright Background
      "#FF6E79" # base09: Bright Red
      "#8A8A8E" # base0A: Muted text
      "#3A3A3E" # base0B: Divider
      "#7EC1F5" # base0C: Light Blue
      "#FF92D0" # base0D: Light Magenta
      "#A4F0FF" # base0E: Light Cyan
      "#FFFFFF" # base0F: Light Background
    ];

    hud-cool = [
      "#1A1A1E" # base00: Background
      "#E05F65" # base01: Red (muted)
      "#7EC49D" # base02: Green (sage)
      "#D4A957" # base03: Yellow (amber)
      "#6E9BCB" # base04: Blue (steel)
      "#B07EB5" # base05: Magenta (dusty)
      "#6AAFB2" # base06: Cyan (teal)
      "#E8E8EC" # base07: Foreground
      "#2A2A2E" # base08: Bright Background
      "#EA7A7F" # base09: Bright Red
      "#8A8A8E" # base0A: Muted text
      "#3A3A3E" # base0B: Divider
      "#88B4D8" # base0C: Light Blue
      "#C499C9" # base0D: Light Magenta
      "#7FC4C8" # base0E: Light Cyan
      "#F5F5F8" # base0F: Light Background
    ];

    hud-warm = [
      "#1A1A1E" # base00: Background
      "#D4644A" # base01: Red (terracotta)
      "#8B9E5E" # base02: Green (olive)
      "#D9A84E" # base03: Yellow (amber)
      "#5E8FAE" # base04: Blue (slate)
      "#A87399" # base05: Magenta (mauve)
      "#5EA3A0" # base06: Cyan (patina)
      "#E0DDD8" # base07: Foreground
      "#2A2A2E" # base08: Bright Background
      "#E07A62" # base09: Bright Red
      "#8A8A8E" # base0A: Muted text
      "#3A3A3E" # base0B: Divider
      "#78AEC8" # base0C: Light Blue
      "#BE8DB3" # base0D: Light Magenta
      "#78BEBA" # base0E: Light Cyan
      "#F0EDE8" # base0F: Light Background
    ];
  };
}
