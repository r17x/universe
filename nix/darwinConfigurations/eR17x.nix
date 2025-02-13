{
  inputs,
  lib,
  pkgs,
  ezModules,
  ...
}:

{
  imports = lib.attrValues (ezModules // inputs.self.nixosModules);

  system.stateVersion = 4;
  nixpkgs.hostPlatform = "aarch64-darwin";

  users.users.r17 = {
    home = "/Users/r17";
    shell = pkgs.fish;
  };

  mouseless.enable = true;
  mouseless.wm = "aerospace";
  homebrew.enable = true;

  networking.hostName = "eR17x";
  networking.computerName = "eR17x";

  nix.settings.trusted-users = [ "@admin" ];
  nix.settings.builders-use-substitutes = true;
  nix.linux-builder = {
    enable = true;
    ephemeral = true;
    maxJobs = 4;
    config = {
      virtualisation = {
        darwin-builder = {
          diskSize = 40 * 1024;
          memorySize = 8 * 1024;
        };
        cores = 6;
      };
      nix.settings.sandbox = false;
      users.users.root.openssh.authorizedKeys.keys = [
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKvi3Co5fB1dSU2Qs1sR6LwdB1hM6HCyIWfXsC0wgz1pmeFlje24SzPCxDtsVMq28fDpEBsXPqKSZbUIyBtHRnpIc72Z8IV0KNtBjbKQTfHLTiDu43e+VLuAdFE7u2Wf5KPQIQ52r/jr9P7UKU2GKwV016OzrRiaZjm+gixmd8YRfidzG1bsL5fbKBjxCIUROdVpW5kNNtPZHpeuHCkZ7341USC6V2qnp1BNHIoHLjRYosV82apOxN/AWY/tMN2jlVQ/gKIUHbxXoILsG+XRFCen5TSSearx54KxifI1aIWbxVVmmYNuLXGWnVumaH6U7ARpz2cEXQB9z2lvJGYmod8qfloVdjXESu8OFe4RT+nj0JUQs7pMhiN6K1AsMQiyFc0ZmU2UNx4JcHre5STnSKUHUCx4zzoToFvIQRBTB3HePHy74FcXWaYDAN/6YF3JEA203nyYL4o5m/KhSXNkcT3H+r3IAqKnl7J7obsvNowwa1UB2NxVmq0VXXR8uZlT0="
      ];
    };
  };
}
