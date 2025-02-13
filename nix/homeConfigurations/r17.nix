{
  inputs,
  lib,
  pkgs,
  ezModules,
  ...
}:

{
  home = rec {
    username = "r17";
    stateVersion = "24.05";
    homeDirectory = if pkgs.stdenv.isLinux then "/home/${username}" else "/Users/${username}";
    packages = [
      inputs.self.packages.${pkgs.stdenv.system}.nvim
    ];
  };

  within = {
    gpg.enable = true;
    pass.enable = true;
  };

  programs.terminal.use = "ghostty";

  imports = lib.attrValues ezModules ++ [
    # --- secrets
    inputs.sops.homeManagerModules.sops
    {
      sops.gnupg.home = "~/.gnupg";
      sops.gnupg.sshKeyPaths = [ ];
      sops.defaultSopsFile = "${inputs.self}/secrets/secret.yaml";
      sops.secrets.openai_api_key.path = "%r/openai_api_key";
      sops.secrets.codeium.path = "%r/codeium";
      programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d --config /dev/null";
      home.packages = [ pkgs.sops ];
    }
    # --- secrets
  ];

}
