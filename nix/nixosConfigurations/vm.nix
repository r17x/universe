# This is example how to use github:astro/microvm.nix as host (NixOS) as a VM Server
# and have aarch64 VMs running on it.
#
# Limitations:
# * The VM (`aarch64`) cannot run correctly, because host (`microvm-host`) is running on qemu `linux-builder`

{
  inputs,
  ezModules,
  ...
}:

{
  imports = [
    "${inputs.nixpkgs}/nixos/modules/profiles/nix-builder-vm.nix"
    inputs.microvm.nixosModules.host
    (
      { pkgs, lib, ... }:
      {
        microvm = rec {
          autostart = lib.attrNames vms;
          vms = {
            aarch64 = {
              inherit pkgs;
              config = {
                microvm = {
                  volumes = [
                    {
                      mountPoint = "/var";
                      image = "var.img";
                      size = 256;
                    }
                  ];
                  shares = [
                    {
                      proto = "9p";
                      tag = "ro-store";
                      source = "/nix/store";
                      mountPoint = "/nix/.ro-store";
                    }
                  ];
                  hypervisor = "qemu";
                  socket = "control.socket";
                };
                environment.systemPackages = with pkgs; [
                  cowsay
                  htop
                ];
              };
            };
          };
        };
      }
    )

    # --- my configurations
    ezModules.nix
    {
      # --- see: nix/nixosModules/nix.nix
      nix-settings.enable = true;

      nixpkgs.hostPlatform = "aarch64-linux";
      system.stateVersion = "24.05";
      networking.hostName = "microvm-host";
      users.users.root.password = "";
      users.users.root.openssh.authorizedKeys.keys = inputs.self.users.r17.keys;
    }
  ];
}
