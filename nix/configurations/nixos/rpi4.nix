{
  inputs,
  lib,
  pkgs,
  ...
}:

{
  imports = [
    "${inputs.nixpkgs}/nixos/modules/installer/sd-card/sd-image-aarch64.nix"
    inputs.nixos-hardware.nixosModules.raspberry-pi-4
  ];

  # thanks to fzakaria.com - https://fzakaria.com/2024/08/13/nixos-raspberry-pi-me
  boot.supportedFilesystems.zfs = lib.mkForce false;
  sdImage.compressImage = false;
  hardware.raspberry-pi."4".touch-ft5406.enable = false;

  nixpkgs = {
    hostPlatform = "aarch64-linux";
    config = {
      allowUnfree = true;
    };

    overlays = [
      # Workaround: https://github.com/NixOS/nixpkgs/issues/154163
      # modprobe: FATAL: Module sun4i-drm not found in directory
      (_final: super: {
        makeModulesClosure = x: super.makeModulesClosure (x // { allowMissing = true; });
      })
    ];
  };

  networking = {
    networkmanager.enable = true;
    firewall.allowedTCPPorts = [
      22
      80
    ];
    hostName = "komunix";
  };

  time.timeZone = "Asia/Jakarta";

  environment.systemPackages = with pkgs; [
    libraspberrypi
    raspberrypi-eeprom
  ];

  users.users.komunix = {
    isNormalUser = true;
    shell = pkgs.bash;
    extraGroups = [
      "wheel"
      "networkmanager"
    ];
    description = "Komunix.org";
    openssh.authorizedKeys.keys = [
      # r17x
      "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKvi3Co5fB1dSU2Qs1sR6LwdB1hM6HCyIWfXsC0wgz1pmeFlje24SzPCxDtsVMq28fDpEBsXPqKSZbUIyBtHRnpIc72Z8IV0KNtBjbKQTfHLTiDu43e+VLuAdFE7u2Wf5KPQIQ52r/jr9P7UKU2GKwV016OzrRiaZjm+gixmd8YRfidzG1bsL5fbKBjxCIUROdVpW5kNNtPZHpeuHCkZ7341USC6V2qnp1BNHIoHLjRYosV82apOxN/AWY/tMN2jlVQ/gKIUHbxXoILsG+XRFCen5TSSearx54KxifI1aIWbxVVmmYNuLXGWnVumaH6U7ARpz2cEXQB9z2lvJGYmod8qfloVdjXESu8OFe4RT+nj0JUQs7pMhiN6K1AsMQiyFc0ZmU2UNx4JcHre5STnSKUHUCx4zzoToFvIQRBTB3HePHy74FcXWaYDAN/6YF3JEA203nyYL4o5m/KhSXNkcT3H+r3IAqKnl7J7obsvNowwa1UB2NxVmq0VXXR8uZlT0="
      # faultables
      "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBHnjecqMe2lrGzAvQ2VQRTXhjZ5q1tONgme+2/97Z3VSXdY0i2bEH3qGEIC7uMyWUfmLystXxqP0u6/Xspmm0Ck="
    ];
    # Allow the graphical user to login without password
    initialHashedPassword = "";
  };

  services.openssh = {
    enable = true;
    banner = ''

       _   __                            _      
      | | / /                           (_)     
      | |/ /  ___  _ __ ___  _   _ _ __  ___  __
      |    \ / _ \| '_ ` _ \| | | | '_ \| \ \/ /
      | |\  \ (_) | | | | | | |_| | | | | |>  < 
      \_| \_/\___/|_| |_| |_|\__,_|_| |_|_/_/\_\
                                                
          ;/nix/store/milik-bersama;

    '';
  };
  # simplify sudo
  security = {
    sudo = {
      enable = true;
      wheelNeedsPassword = false;
    };
  };

  # Allow the user to log in as root without a password.
  users.users.root.initialHashedPassword = "";

  hardware.enableRedistributableFirmware = true;
  system.stateVersion = "25.05";
}
