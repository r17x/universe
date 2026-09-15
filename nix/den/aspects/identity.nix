{ ... }:
{
  den.aspects.identity = {
    darwin = _: {
      programs.gnupg = {
        agent.enable = true;
        agent.enableSSHSupport = true;
      };
    };

    homeManager =
      { lib, pkgs, ... }:
      {
        home.packages = [ pkgs.gnupg ];

        programs.gpg = {
          enable = true;
          settings = {
            use-agent = true;
          };
        };

        home.file = lib.mkIf pkgs.stdenv.isDarwin {
          ".gnupg/gpg-agent.conf".source = pkgs.writeTextFile {
            name = "home-gpg-agent.conf";
            text = ''
              pinentry-program ${pkgs.pinentry_mac}/Applications/pinentry-mac.app/Contents/MacOS/pinentry-mac
            '';
          };
        };
      };
  };
}
