{ inputs, ... }:
{
  den.aspects.sops-secrets = {
    homeManager =
      { pkgs, ... }:
      {
        imports = [ inputs.sops-nix.homeManagerModules.sops ];

        sops.gnupg.home = "~/.gnupg";
        sops.gnupg.sshKeyPaths = [ ];
        sops.defaultSopsFile = "${inputs.self}/secrets/secret.yaml";
        sops.secrets.openai_api_key.path = "%r/openai_api_key";
        sops.secrets.codeium.path = "%r/codeium";
        sops.secrets.git_identities = { };
        sops.secrets.berkarya_gpg_key = { };

        programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d --config /dev/null";
        home.packages = [ pkgs.sops ];
      };
  };
}
