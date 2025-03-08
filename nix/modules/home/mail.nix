{
  programs.himalaya.enable = true;

  accounts.email = {
    maildirBasePath = "Documents/Mail";
    accounts.r17x = rec {
      himalaya.enable = true;
      maildir.path = "r17x";
      userName = "r17x666";
      address = "${userName}@icloud.com";
      realName = "Rin";
      primary = true;
      passwordCommand = "pass show r17x/icloud.app.password";
      imap = {
        host = "imap.mail.me.com";
        port = 993;
        tls.enable = true;
      };
      smtp = {
        host = "smtp.mail.me.com";
        port = 587;
        tls.enable = true;
        tls.useStartTls = true;
      };
    };
  };
}
