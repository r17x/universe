{
  inputs,
  lib,
  config,
  pkgs,
  ezModules,
  osConfig ? { },
  ...
}:

{
  home = {
    username = lib.mkDefault "r17";
    stateVersion = "25.05";
    homeDirectory =
      osConfig.users.users.${config.home.username}.home or "/Users/${config.home.username}";
    packages = [
      inputs.self.packages.${pkgs.stdenv.system}.nvim
      inputs.self.packages.${pkgs.stdenv.system}.universe
      pkgs.claude-code
    ];
    sessionVariables.EDITOR = lib.getExe' inputs.self.packages.${pkgs.stdenv.system}.nvim "nvim";
    sessionVariables.CLAUDE_CODE_DISABLE_1M_CONTEXT = 1;
  };

  within = {
    gpg.enable = true;
    pass.enable = true;
  };

  programs.terminal.use = "ghostty";

  imports = lib.attrValues ezModules ++ [
    # --- secrets
    inputs.sops-nix.homeManagerModules.sops
    {
      sops.gnupg.home = "~/.gnupg";
      sops.gnupg.sshKeyPaths = [ ];
      sops.defaultSopsFile = "${inputs.self}/secrets/secret.yaml";
      sops.secrets.openai_api_key.path = "%r/openai_api_key";
      sops.secrets.codeium.path = "%r/codeium";
      sops.secrets.git_identities = { };
      sops.secrets.berkarya_gpg_key = { };
      programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d --config /dev/null";
      home.packages = [ pkgs.sops ];
    }
    # --- secrets
  ];

}
