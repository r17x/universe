{
  self,
  lib,
  inputs,
  ...
}:

{
  imports = [
    inputs.clan-core.flakeModules.default
  ];

  clan = {
    meta.name = "rinne";

    inventory.tags.vm = [ "jeto1" ];
    inventory.services = {
      sshd.r17 = {
        roles.server.tags = [ "all" ];
        roles.client.tags = [ "all" ];
        config.certificate.searchDomains = [ "rin.rocks" ];
      };
      zerotier.r17 = {
        roles.controller.machines = [ "bizgio" ];
      };
    };

    specialArgs.self = {
      inputs = lib.attrsets.filterAttrs (_: lib.isType "flake") self.inputs;
      inherit (self) users;
    };

    machines = {
      jeto1 = {
        imports = [ self.nixosModules.server ];

        nixpkgs.hostPlatform = "x86_64-linux";
        system.stateVersion = "25.05";

        clan.core.networking.targetHost = "root@jeto.rin.rocks";
        clan.core.sops.defaultGroups = [ "admins" ];

        disko.devices.disk.main.device =
          lib.mkForce "/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi0-0-0-0";
        systemd.network.networks."10-uplink".networkConfig.Address =
          lib.mkForce "fe80::225:54ff:fe92:3af8/64";
        networking.interfaces.ens3.useDHCP = true;
      };

      bizgio = {
        imports = [ self.nixosModules.server ];

        nixpkgs.hostPlatform = "x86_64-linux";
        system.stateVersion = "25.05";

        clan.core.networking.targetHost = "root@bizgio.rin.rocks";
        # clan.core.networking.buildHost = "linux-builder";
        clan.core.sops.defaultGroups = [ "admins" ];

        disko.devices.disk.main.device = lib.mkForce "/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi0";
        networking = rec {
          interfaces.ens18 = {
            useDHCP = false;
            ipv4.addresses = [
              {
                address = "103.87.66.104";
                prefixLength = 23;
              }
            ];
            ipv4.routes = [
              {
                address = defaultGateway.address;
                via = "0.0.0.0";
                prefixLength = 0;
              }
            ];
            mtu = 1500;
            macAddress = "bc:24:11:25:80:00";
          };
          defaultGateway.address = "103.87.67.254";
          defaultGateway.interface = "ens18";
        };

        systemd.network.networks = {
          "10-uplink".networkConfig.Address = lib.mkForce "fe80::be24:11ff:fe25:8000/64";
        };
      };

      didin = {
        imports = [ self.nixosModules.server ];

        nixpkgs.hostPlatform = "x86_64-linux";
        system.stateVersion = "25.05";
        clan.core.networking.buildHost = "linux-builder";
        clan.core.networking.targetHost = "root@didin";

        disko.devices.disk.main.device = lib.mkForce "/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi0";
        systemd.network.networks."10-uplink".networkConfig.Address =
          lib.mkForce "fe80::3c9f:d0ff:fe51:dfa7/64";
        networking.interfaces.eth0.useDHCP = true;
      };
    };
  };
}
