{ config, pkgs, lib, ... }:

{
  home.sessionVariables = {
    EDITOR = "nvim";
    CC = lib.optionalString (pkgs.stdenv.isDarwin) "gcc";
  };

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;

  home.activation = {

    copyApplications =
      lib.hm.dag.entryAfter [ "writeBoundary" ]
        (lib.optionalString (pkgs.stdenv.isDarwin)
          (
            let
              apps = pkgs.buildEnv {
                name = "home-manager-applications";
                paths = config.home.packages;
                pathsToLink = "/Applications";
              };
            in
            ''
              baseDir="$HOME/Applications/Home Manager Apps"
              if [ -d "$baseDir" ]; then
                rm -rf "$baseDir"
              fi
              mkdir -p "$baseDir"
              for appFile in ${apps}/Applications/*; do
                target="$baseDir/$(basename "$appFile")"
                $DRY_RUN_CMD cp ''${VERBOSE_ARG:+-v} -fHRL "$appFile" "$baseDir"
                $DRY_RUN_CMD chmod ''${VERBOSE_ARG:+-v} -R +w "$target"
              done
            ''
          )
        )
    ;

    # this activation for update nix-index-database by system (darwin|linux)
    # nix-index-database it's use for "comma" - run without install
    updateNixIndexDB = lib.hm.dag.entryAfter [ "writeBoundary" ] (lib.optionalString (config.programs.nix-index.enable) ''
      filename="index-x86_64-$(uname | tr A-Z a-z)"
      cacheNixIndex="$HOME/.cache/nix-index"
      if [ ! -d "$cacheNixIndex"]; then 
        mkdir -p $cacheNixIndex
      fi

      cd $cacheNixIndex
      # -N will only download a new version if there is an update.
      ${pkgs.wget}/bin/wget -q -N https://github.com/Mic92/nix-index-database/releases/latest/download/$filename
      ln -f $filename files
    ''
    );
  };

}
