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

  KV = {
    string = a: b: "${toString a}=${b}";
    scheme = a: b: {
      name = "base${if a < 16 then "0${decToHex a}" else decToHex a}";
      value = b;
    };
  };

  toScheme = xs: xs |> lib.lists.imap0 KV.scheme |> lib.attrsets.listToAttrs;

  toKVString = lib.lists.imap0 KV.string;

  mkColor = xs: {
    scheme = toScheme xs;
    listKV = toKVString xs;
  };

in
{
  inherit
    KV
    decToHex
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
  };
}
