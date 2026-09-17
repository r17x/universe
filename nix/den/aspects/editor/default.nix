{ ... }:
{
  den.aspects.editor = {
    nixvim = _: {
      imports = [
        ../../../nvim.nix/config/globals.nix
        ../../../nvim.nix/config/ui.nix
        ../../../nvim.nix/config/navigations.nix
        ../../../nvim.nix/config/dashboard.nix
        ../../../nvim.nix/config/writing.nix
        ../../../nvim.nix/config/lsp.nix
        ../../../nvim.nix/config/git.nix
        ../../../nvim.nix/config/ai.nix
        ../../../nvim.nix/config/secrets.nix
      ];
    };

    homeManager =
      {
        osConfig,
        inputs,
        lib,
        ...
      }:
      {
        home.packages = [
          inputs.self.neovimConfigurations.${osConfig.networking.hostName}.config.build.package
        ];
        home.sessionVariables.EDITOR =
          lib.getExe' inputs.self.neovimConfigurations.${osConfig.networking.hostName}.config.build.package
            "nvim";
      };
  };
}
