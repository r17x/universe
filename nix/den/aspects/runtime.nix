{ den, ... }:
{
  den.aspects.runtime-manifest = {
    homeManager =
      {
        runtime,
        colors,
        pkgs,
        lib,
        ...
      }:
      let
        themeNames = builtins.attrNames colors.lists;
        manifestData = {
          version = 1;
          default_theme = "edge";
          themes = lib.genAttrs themeNames (name: {
            source = "colors.lists.${name}";
          });
          aspects = lib.listToAttrs (
            lib.concatMap (
              entry:
              if entry ? name then
                [
                  {
                    name = entry.name;
                    value = builtins.removeAttrs entry [ "name" ];
                  }
                ]
              else
                [ ]
            ) runtime
          );
        };
        manifestJson = pkgs.writeText "universe-manifest.json" (builtins.toJSON manifestData);
      in
      {
        home.activation.universeManifest = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
          install -Dm644 ${manifestJson} "$HOME/.universe/manifest.json"
        '';
      };
  };
}
