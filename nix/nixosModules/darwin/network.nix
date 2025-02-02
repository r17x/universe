{
  pkgs,
  ...
}:

{
  environment.systemPackages = with pkgs; [
    yggdrasil
    dnscrypt-proxy2
  ];

  services.dnscrypt-proxy = {
    enable = true;
    settings = ./dnscrypt-proxy.toml;
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
      (toString (
        pkgs.writeText "yggdrasil.conf"
          # toml
          ''
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
          ''
      ))
    ];
  };

  services.tailscale = {
    enable = true;
  };
}
