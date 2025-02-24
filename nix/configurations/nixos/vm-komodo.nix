{
  inputs,
  ezModules,
  ...
}:

{
  imports = [
    "${inputs.nixpkgs}/nixos/modules/profiles/nix-builder-vm.nix"
    # --- my configurations
    ezModules.nix
    ezModules.komodo
    (
      { pkgs, ... }:
      {
        services.komodo = {
          enable = true;
          package = inputs.self.packages.${pkgs.stdenv.system}.komodo;
          settings = {
            core = { };
            periphery = {
              repo_dir = "repos/";
              stack_dir = "stack/";
            };
          };
        };

        # --- see: nix/nixosModules/nix.nix
        nix-settings.enable = true;

        nixpkgs.hostPlatform = "aarch64-linux";
        system.stateVersion = "24.05";
        networking.hostName = "vm";
        users.users.root.password = "";
        users.users.root.openssh.authorizedKeys.keys = inputs.self.users.r17.keys;
      }
    )
  ];
}
