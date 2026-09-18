{ den, ... }:
{
  den.aspects.identity = {
    includes = with den.aspects.identity.provides; [
      gpg-agent
      gpg-user
      gpg-pinentry
    ];

    provides.gpg-agent = {
      darwin = _: {
        programs.gnupg = {
          agent.enable = true;
          agent.enableSSHSupport = true;
        };
      };
    };

    provides.gpg-user = {
      homeManager =
        { pkgs, ... }:
        {
          home.packages = [ pkgs.gnupg ];

          programs.gpg = {
            enable = true;
            settings = {
              use-agent = true;
            };
          };
        };
    };

    provides.gpg-pinentry = {
      homeManager =
        { pkgs, ... }:
        {
          home.file.".gnupg/gpg-agent.conf".source = pkgs.writeTextFile {
            name = "home-gpg-agent.conf";
            text = ''
              pinentry-program ${pkgs.pinentry_mac}/Applications/pinentry-mac.app/Contents/MacOS/pinentry-mac
            '';
          };
        };
    };
  };
}
