{ pkgs, config, ... }:
{
  # Shells -----------------------------------------------------------------------------------------

  # Add shells installed by nix to /etc/shells file
  environment = with pkgs; {
    shells = [ fish ];

    variables = {
      SHELL = "${fish}/bin/fish";
      CC = "${gcc}/bin/gcc";
    };
  };

  # Make Fish the default shell
  programs = {
    fish.enable = true;
    fish.useBabelfish = true;
    fish.babelfishPackage = pkgs.babelfish;
    # Needed to address bug where $PATH is not properly set for fish:
    # https://github.com/LnL7/nix-darwin/issues/122
    fish.shellInit = ''
      for p in (string split : ${config.environment.systemPath})
        if not contains $p $fish_user_paths
          set -g fish_user_paths $fish_user_paths $p
        end
      end
    '';
  };
}
