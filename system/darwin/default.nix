# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{ pkgs, ... }:
{

  # Used for backwards compatibility, please read the changelog before changing.
  # $ darwin-rebuild changelog
  system.stateVersion = 4;

  # Apps
  # `home-manager` currently has issues adding them to `~/Applications`
  # Issue: https://github.com/nix-community/home-manager/issues/1341
  environment.systemPackages = with pkgs; [
    # yggdrasil
    iterm2
    dnscrypt-proxy2
    terminal-notifier
  ];

  # something wrong
  # programs.tmux.iTerm2 = config.programs.tmux.enable;

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
