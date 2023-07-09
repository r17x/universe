inputs:

{ pkgs
, prefixName ? "vimPlugins_"
}:

let
  builder = src: pkgs.vimUtils.buildVimPluginFrom2Nix rec {
    inherit src;
    pname = src.name;
    version = src.lastModifiedDate;
  };

  hasPrefix = k: builtins.substring 0 11 k == prefixName;

  removePrefix = k: pkgs.lib.removePrefix prefixName k;

  removePrefixAttr = pkgs.lib.attrsets.mapAttrs' (k: v: pkgs.lib.attrsets.nameValuePair (removePrefix k) v);

  filterWithPrefix = pkgs.lib.attrsets.filterAttrs (k: _: hasPrefix k);

  addNameWithPrefix = pkgs.lib.attrsets.mapAttrs (k: v: v // { name = removePrefix k; });

  builders = pkgs.lib.attrsets.mapAttrs (_: v: (builder v));

  compose = [ filterWithPrefix addNameWithPrefix builders removePrefixAttr ];

  apply = x: f: f x;

in

builtins.foldl' apply inputs compose 
