# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{ pkgs, config, lib, ... }:
{
  # Nix configuration ------------------------------------------------------------------------------

  # Bootstrap
  nix.binaryCaches = [
    "https://cache.nixos.org/"
    "https://r17.cachix.org/"
  ];

  nix.binaryCachePublicKeys = [
    "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
    "r17.cachix.org-1:vz0nG6BCbdgTPn7SEiOwe/3QwvjH1sb/VV9WLcBtkAY="
  ];

  nix.trustedUsers = [
    "@admin"
  ];

  users.nix.configureBuildUsers = true;

  # Enable experimental nix command and flakes
  # nix.package = pkgs.nixFlakes;
  nix.extraOptions = ''
    auto-optimise-store = true
    experimental-features = nix-command flakes
  '' + lib.optionalString (pkgs.system == "aarch64-darwin") ''
    extra-platforms = x86_64-darwin aarch64-darwin
  '';

  # Shells -----------------------------------------------------------------------------------------

  # Add shells installed by nix to /etc/shells file
  environment.shells = with pkgs; [
    bashInteractive
    fish
    zsh
  ];

  # Make Fish the default shell
  programs.fish.enable = true;
  programs.fish.useBabelfish = true;
  programs.fish.babelfishPackage = pkgs.babelfish;
  # Needed to address bug where $PATH is not properly set for fish:
  # https://github.com/LnL7/nix-darwin/issues/122
  programs.fish.shellInit = ''
    for p in (string split : ${config.environment.systemPath})
      if not contains $p $fish_user_paths
        set -g fish_user_paths $fish_user_paths $p
      end
    end
  '';
  environment.variables.SHELL = "${pkgs.fish}/bin/fish";

  # Install and setup ZSH to work with nix(-darwin) as well
  programs.zsh.enable = true;

  # Used for backwards compatibility, please read the changelog before changing.
  # $ darwin-rebuild changelog
  system.stateVersion = 4;

  # Auto upgrade nix package and the daemon service.
  services.nix-daemon.enable = true;

  # Apps
  # `home-manager` currently has issues adding them to `~/Applications`
  # Issue: https://github.com/nix-community/home-manager/issues/1341
  environment.systemPackages = with pkgs; [
    # yggdrasil
    dnscrypt-proxy2
    terminal-notifier
  ];

  # https://github.com/nix-community/home-manager/issues/423
  environment.variables = {
    # 
    # TERMINFO_DIRS = "${pkgs.kitty.terminfo.outPath}/share/terminfo";
  };
  programs.nix-index.enable = true;

  # Fonts
  fonts.fontDir.enable = true;
  fonts.fonts = with pkgs; [
    recursive
    (nerdfonts.override { fonts = [ "JetBrainsMono" "FiraCode" "Hack" ]; })
  ];

  # Keyboard
  system.keyboard.enableKeyMapping = true;
  system.keyboard.remapCapsLockToEscape = true;

  # Add ability to used TouchID for sudo authentication
  security.pam.enableSudoTouchIdAuth = false;

  # Networks
  # dnscrypt-proxy
  launchd.user.agents.dnscrypt-proxy = {
    serviceConfig.RunAtLoad = true;
    serviceConfig.KeepAlive = true;
    serviceConfig.ProgramArguments = [
      "${pkgs.dnscrypt-proxy2}/bin/dnscrypt-proxy"
      "-config"
      (toString (pkgs.writeText "dnscrypt-proxy.toml" ''
        server_names = ['google', 'cloudflare', 'cloud9']
        listen_addresses = ["127.0.0.1:5053"]
      ''))
    ];
  };
  # yggdrasil see https://yggdrasil-network.github.io/
  # launchd.agents.yggdrasil = {
  #   serviceConfig.RunAtLoad = true;
  #   serviceConfig.KeepAlive = true;
  #   serviceConfig.ProcessType = "Interactive";
  #   serviceConfig.StandardOutPath = "/tmp/yggdrasil.out.log";
  #   serviceConfig.StandardErrorPath = "/tmp/yggdrasil.err.log";
  #   serviceConfig.ProgramArguments = [
  #     "${pkgs.yggdrasil}/bin/yggdrasil"
  #     "-useconffile"
  #     (toString (pkgs.writeText "yggdrasil.conf" ''
  #           {
  #       Peers: [
  #         tls://yggdr.id:4433
  #       ]

  #       InterfacePeers: {}

  #       Listen: [
  #         tls://0.0.0.0:0
  #       ]

  #       AdminListen: none

  #       MulticastInterfaces:
  #       [
  #         {
  #           Regex: en.*
  #           Beacon: true
  #           Listen: true
  #           Port: 0
  #         }
  #         {
  #           Regex: bridge.*
  #           Beacon: true
  #           Listen: true
  #           Port: 0
  #         }
  #       ]

  #       AllowedPublicKeys: []

  #       PublicKey: 22e1d2156e4984696caba8d95fa110e54efc09d1dee0e816d1011dd2d4dd5038

  #       PrivateKey: ff95a9e5095e6324bd90632550b0b19b34629b4eecdb4b66646214f4ffe05eca22e1d2156e4984696caba8d95fa110e54efc09d1dee0e816d1011dd2d4dd5038

  #       IfName: auto

  #       IfMTU: 65535

  #       NodeInfoPrivacy: false

  #       NodeInfo: {}
  #           }
  #     ''))
  #   ];
  # };


}
