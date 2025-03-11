{ self, ... }:

{
  imports = with self.inputs.clan-core.clanModules; [
    state-version
    trusted-nix-caches
    self.inputs.srvos.nixosModules.server
    "${self.inputs.nixpkgs}/nixos/modules/installer/scan/not-detected.nix"
    "${self.inputs.clan-core}/templates/clan/new-clan/modules/disko.nix"

    # initrd network
    (
      { pkgs, config, ... }:
      {
        environment.systemPackages = [ pkgs.neofetch ];
        users.users.root.openssh.authorizedKeys.keys = self.users.r17.keys;

        boot.initrd.systemd.enable = true;
        boot.initrd.network = {
          enable = true;
          ssh = {
            enable = true;
            port = 22;
            hostKeys = [
              config.clan.core.vars.generators.initrd-ssh.files.id_ed25519.path
            ];
            authorizedKeys = config.users.users.root.openssh.authorizedKeys.keys;
          };
        };

        # SSH key generation
        clan.core.vars.generators.initrd-ssh = {
          files."id_ed25519".neededFor = "activation";
          files."id_ed25519.pub".secret = false;
          runtimeInputs = [
            pkgs.coreutils
            pkgs.openssh
          ];
          script = ''
            ssh-keygen -t ed25519 -N "" -f $out/id_ed25519
          '';
        };

        # Network Configuration
        networking = {
          useDHCP = false;
          nameservers = [
            "1.1.1.1"
            "8.8.8.8"
          ];
          firewall = {
            enable = true;
            allowedTCPPorts = [
              80
              22
              443
            ];
          };
        };
      }
    )
  ];
}
