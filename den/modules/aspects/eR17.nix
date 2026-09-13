{ den, ... }:
{
  den.aspects.eR17 = {
    includes = [
      den.batteries.primary-user

      den.aspects.nix-settings
      den.aspects.fish-shell

      den.aspects.system
      den.aspects.darwin-gpg
      den.aspects.homebrew
      den.aspects.darwin-packages
      den.aspects.mouseless

      den.aspects.home-gpg
      den.aspects.pass
      den.aspects.mail
      den.aspects.home-packages
      den.aspects.git
      den.aspects.activation
      den.aspects.tmux
      den.aspects.terminal
      den.aspects.home-shells
      den.aspects.sops-secrets
    ];

    darwin =
      { config, pkgs, ... }:
      {
        nixpkgs.hostPlatform = "aarch64-darwin";

        users.users.r17.shell = pkgs.fish;

        nix-settings = {
          enable = true;
          use = "full";
          inputs-to-registry = true;
        };

        mouseless.enable = true;
        mouseless.wm = "aerospace";

        homebrew.enable = true;

        networking.computerName = config.networking.hostName;
      };

    homeManager =
      {
        inputs,
        lib,
        pkgs,
        ...
      }:
      {
        home = {
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
      };
  };
}
