{
  inputs,
  crossModules,
  ...
}:

{
  imports = [
    "${inputs.nixpkgs}/nixos/modules/profiles/nix-builder-vm.nix"

    # --- my configurations
    crossModules.nix
    {
      # --- see: nix/nixosModules/nix.nix
      nix-settings.enable = true;

      nixpkgs.hostPlatform = "aarch64-linux";
      system.stateVersion = "24.05";
      networking.hostName = "vm";
      boot.binfmt.emulatedSystems = [ "x86_64-linux" ];
      users.users.root.password = "";
      users.users.root.openssh.authorizedKeys.keys = inputs.self.users.r17.keys;
    }
  ];
}
