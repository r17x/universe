{ ... }:

{
  # Let Home Manager install and manage itself.
  # home.activation = {
  # copyApplications =
  #   lib.hm.dag.entryAfter [ "writeBoundary" ]
  #     (lib.optionalString (pkgs.stdenv.isDarwin)
  #       (
  #         let
  #           apps = pkgs.buildEnv {
  #             name = "home-manager-applications";
  #             paths = config.home.packages;
  #             pathsToLink = "/Applications";
  #           };
  #         in
  #         ''
  #           echo "setting up ${config.home.homeDirectory}/Applications/Home\ Manager\ Applications...">&2

  #           ourLink () {
  #             local link
  #             link=$(readlink "$1")
  #             [ -L "$1" ] && [ "''${link#*-}" = 'system-applications/Applications' ]
  #           }

  #           # cleanup
  #           if ourLink ~/Applications; then
  #             mv ~/Applications ~/Applications/hma.backup-before-nix 
  #           elif ourLink ~/Applications/Home\ Manager\ Apps; then
  #             mv ~/Applications/Home\ Manager\ Apps ~/Applications/hma.backup-before-nix 
  #           fi

  #            if [ ! -e '~/Applications/Home Manager Apps' ] \
  #             || ourLink '~/Applications/Home Manager Apps'; then
  #             ln -sfn ${apps}/Applications '~/Applications/Home Manager Apps'
  #           else
  #             echo "warning: /Applications/Home Manager Apps is not owned by nix-darwin, skipping App linking..." >&2
  #           fi
  #         ''
  #       )
  #     )
  # ;

  # this activation for update nix-index-database by system (darwin|linux)
  # nix-index-database it's use for "comma" - run without install
  # updateNixIndexDB = lib.hm.dag.entryAfter [ "writeBoundary" ] (lib.optionalString (config.programs.nix-index.enable) ''
  #   filename="index-x86_64-$(uname | tr A-Z a-z)"
  #   cacheNixIndex="$HOME/.cache/nix-index"
  #   if [ ! -d "$cacheNixIndex"]; then 
  #     mkdir -p $cacheNixIndex
  #   fi

  #   cd $cacheNixIndex
  #   # -N will only download a new version if there is an update.
  #   ${pkgs.wget}/bin/wget -q -N https://github.com/Mic92/nix-index-database/releases/latest/download/$filename
  #   ln -f $filename files
  # ''
  # );
  # };
}
