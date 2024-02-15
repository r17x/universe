{ pkgs, config, lib, ... }:

{
  environment.systemPackages = with pkgs;[
    yggdrasil
    dnscrypt-proxy2
  ];

  # dnscrypt-proxy
  launchd.daemons.dnscrypt-proxy = {
    path = [ config.environment.systemPath ];
    serviceConfig.RunAtLoad = true;
    serviceConfig.KeepAlive = true;
    serviceConfig.StandardOutPath = "/tmp/launchd-dnscrypt.log";
    serviceConfig.StandardErrorPath = "/tmp/launchd-dnscrypt.error";
    serviceConfig.ProgramArguments = [
      "${pkgs.dnscrypt-proxy2}/bin/dnscrypt-proxy"
      "-config"
      (lib.trivial.pipe ./../../configs/dnscrypt-proxy.toml [
        builtins.readFile
        (pkgs.writeText "dnscrypt-proxy.toml")
        toString
      ])
    ];
  };

  # yggdrasil see https://yggdrasil-network.github.io/
  # TODO: need to replace all public / private key
  launchd.daemons.yggdrasil = {
    serviceConfig.RunAtLoad = true;
    serviceConfig.KeepAlive = true;
    serviceConfig.ProcessType = "Interactive";
    serviceConfig.StandardOutPath = "/tmp/yggdrasil.out.log";
    serviceConfig.StandardErrorPath = "/tmp/yggdrasil.err.log";
    serviceConfig.ProgramArguments = [
      "${pkgs.yggdrasil}/bin/yggdrasil"
      "-useconffile"
      (toString (pkgs.writeText "yggdrasil.conf" ''
        {
          Peers: [
            tls://cgk01.edgy.direct.id:54321
          ]

          InterfacePeers: {}

          Listen: [ ]

          AdminListen: none

          MulticastInterfaces:
          [
            {
              Regex: en.*
              Beacon: true
              Listen: true
              Port: 0
            }
            {
              Regex: bridge.*
              Beacon: true
              Listen: true
              Port: 0
            }
          ]

          AllowedPublicKeys: []

          PublicKey: 22e1d2156e4984696caba8d95fa110e54efc09d1dee0e816d1011dd2d4dd5038

          PrivateKey: ff95a9e5095e6324bd90632550b0b19b34629b4eecdb4b66646214f4ffe05eca22e1d2156e4984696caba8d95fa110e54efc09d1dee0e816d1011dd2d4dd5038

          IfName: auto

          IfMTU: 65535

          NodeInfoPrivacy: false

          NodeInfo: {}
        }
      ''))
    ];
  };

  services.tailscale = {
    enable = true;
  };
}
