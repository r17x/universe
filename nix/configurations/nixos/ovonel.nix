{
  inputs,
  crossModules,
  ...
}:

{
  imports = [
    crossModules.nix
    {
      # --- see: nix/modules/cross/nix.nix
      nix-settings.enable = true;

      nixpkgs.hostPlatform = "x86_64-linux";
      system.stateVersion = "25.05";
      networking.hostName = "ovonel";
      users.users.root.openssh.authorizedKeys.keys = inputs.self.users.r17.keys;
    }
  ];
}
