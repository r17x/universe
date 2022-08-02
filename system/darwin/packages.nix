# I have been start to use fully in nix at 9-Feb-2022
# and found how to create flake, home-manager, and darwin in nix 
# Here: https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050

{ pkgs, ... }:
{
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
  # fonts.fontDir.enable = true;
  # fonts.fonts = with pkgs; [
  #   recursive
  #   (nerdfonts.override { fonts = [ "JetBrainsMono" "FiraCode" "Hack" ]; })
  # ];

  # Networks
  # dnscrypt-proxy
  launchd.agents.dnscrypt-proxy = {
    serviceConfig.RunAtLoad = true;
    serviceConfig.KeepAlive = true;
    serviceConfig.StandardOutPath = "/tmp/launchd-dnscrypt.log";
    serviceConfig.StandardErrorPath = "/tmp/launchd-dnscrypt.error";
    serviceConfig.ProgramArguments = [
      "${pkgs.dnscrypt-proxy2}/bin/dnscrypt-proxy"
      "-config"
      (toString (pkgs.writeText "dnscrypt-proxy.toml" ''
        ##############################################
        #                                            #
        #        dnscrypt-proxy configuration        #
        #                                            #
        ##############################################
      
        listen_addresses = ['127.0.0.1:53', '[::1]:53']
      
        server_names = ['cloudflare', 'mullvad-adblock-doh', 'doh-crypto-sx', 'doh-crypto-sx-ipv6', 'doh-de-blahdns-v6', 'doh-de-blahdns', 'dnscrypt-ch-blahdns-ipv4', 'dnscrypt-ch-blahdns-ipv6', 'dnscrypt-de-blahdns-ipv4', 'dnscrypt-de-blahdns-ipv6']
      
        max_clients = 250
      
        # Use servers reachable over IPv4
        ipv4_servers = true
      
        # Use servers reachable over IPv6
        ipv6_servers = true
      
        # Use servers implementing the DNSCrypt protocol
        dnscrypt_servers = true
      
        # Use servers implementing the DNS-over-HTTPS protocol
        doh_servers = true
      
        # Server must support DNS security extensions (DNSSEC)
        require_dnssec = true
      
        # Server must not log user queries (declarative)
        require_nolog = true
      
        # Server must not enforce its own blocklist (for parental control, ads blocking...)
        require_nofilter = false
      
        disabled_server_names = ['google', 'yandex', 'altername']
      
        force_tcp = false
        timeout = 5000
        keepalive = 30
        cert_refresh_delay = 240
        bootstrap_resolvers = ['9.9.9.9:53', '8.8.8.8:53']  # renamed from fallback_resolvers to bootstrap_resolvers in version 2.1.0. use fallback_resolvers if under version 2.1.0
      
        ignore_system_dns = true
        netprobe_timeout = 60
        netprobe_address = '9.9.9.9:53'
        log_files_max_size = 10
        log_files_max_age = 7
        log_files_max_backups = 1
        block_ipv6 = false
        block_unqualified = true
        block_undelegated = true
        reject_ttl = 600
        cache = true
        cache_size = 4096
        cache_min_ttl = 2400
        cache_max_ttl = 86400
        cache_neg_min_ttl = 60
        cache_neg_max_ttl = 600
      
        [query_log]
          file = 'query.log'
          format = 'tsv'
      
        [nx_log]
          file = 'nx.log'
          format = 'tsv'

        [sources]

          [sources.public-resolvers]
            urls = ['https://raw.githubusercontent.com/DNSCrypt/dnscrypt-resolvers/master/v3/public-resolvers.md', 'https://download.dnscrypt.info/resolvers-list/v3/public-resolvers.md', 'https://ipv6.download.dnscrypt.info/resolvers-list/v3/public-resolvers.md']
            cache_file = 'public-resolvers.md'
            minisign_key = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3'
            refresh_delay = 72
            prefix = ""


          [sources.relays]
            urls = ['https://raw.githubusercontent.com/DNSCrypt/dnscrypt-resolvers/master/v3/relays.md', 'https://download.dnscrypt.info/resolvers-list/v3/relays.md', 'https://ipv6.download.dnscrypt.info/resolvers-list/v3/relays.md']
            cache_file = 'relays.md'
            minisign_key = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3'
            refresh_delay = 72
            prefix = ""

        [broken_implementations]
          fragments_blocked = ['cisco', 'cisco-ipv6', 'cisco-familyshield', 'cisco-familyshield-ipv6', 'cleanbrowsing-adult', 'cleanbrowsing-adult-ipv6', 'cleanbrowsing-family', 'cleanbrowsing-family-ipv6', 'cleanbrowsing-security', 'cleanbrowsing-security-ipv6']

        [anonymized_dns]
          skip_incompatible = false

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
