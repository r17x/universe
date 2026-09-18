{ ... }:
{
  den.aspects.mail =
    { user, ... }:
    {
      homeManager =
        { lib, ... }:
        lib.mkIf (user.mail != { }) {
          programs.himalaya.enable = true;
          accounts.calendar.basePath = ".calendar";
          accounts.email = {
            maildirBasePath = "Documents/Mail";
            accounts = user.mail;
          };
        };
    };
}
