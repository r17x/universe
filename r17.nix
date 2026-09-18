{ ... }:
{
  den.profiles.r17 = {
    user = {
      handle = "r17x";
      shell = "fish";
      font = "Kode Mono";
      primaryCache = "r17";
      configDirectory = "~/.config/nixpkgs";
      browsers = [ "firefox" ];

      keys = [
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKvi3Co5fB1dSU2Qs1sR6LwdB1hM6HCyIWfXsC0wgz1pmeFlje24SzPCxDtsVMq28fDpEBsXPqKSZbUIyBtHRnpIc72Z8IV0KNtBjbKQTfHLTiDu43e+VLuAdFE7u2Wf5KPQIQ52r/jr9P7UKU2GKwV016OzrRiaZjm+gixmd8YRfidzG1bsL5fbKBjxCIUROdVpW5kNNtPZHpeuHCkZ7341USC6V2qnp1BNHIoHLjRYosV82apOxN/AWY/tMN2jlVQ/gKIUHbxXoILsG+XRFCen5TSSearx54KxifI1aIWbxVVmmYNuLXGWnVumaH6U7ARpz2cEXQB9z2lvJGYmod8qfloVdjXESu8OFe4RT+nj0JUQs7pMhiN6K1AsMQiyFc0ZmU2UNx4JcHre5STnSKUHUCx4zzoToFvIQRBTB3HePHy74FcXWaYDAN/6YF3JEA203nyYL4o5m/KhSXNkcT3H+r3IAqKnl7J7obsvNowwa1UB2NxVmq0VXXR8uZlT0="
      ];

      secrets = [
        "openai_api_key"
        "git_identities"
        "berkarya_gpg_key"
      ];
      gpgTrust.berkarya_gpg_key = "rin@berkarya.ai";

      sessionVariables.CLAUDE_CODE_DISABLE_1M_CONTEXT = 1;
      sessionPath = [ "$HOME/.yarn/bin" ];

      caches = {
        r17 = {
          url = "https://r17.cachix.org";
          key = "r17.cachix.org-1:vz0nG6BCbdgTPn7SEiOwe/3QwvjH1sb/VV9WLcBtkAY=";
        };
        nixos = {
          url = "https://cache.nixos.org/";
          key = "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=";
        };
        nix-community = {
          url = "https://nix-community.cachix.org";
          key = "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs=";
        };
        pre-commit-hooks = {
          url = "https://pre-commit-hooks.cachix.org";
          key = "pre-commit-hooks.cachix.org-1:Pkk3Panw5AW24TOv6kz3PvLhlH8puAsJTBbOPmBo7Rc=";
        };
        clan = {
          url = "https://cache.clan.lol";
          key = "cache.clan.lol-1:3KztgSAB5R1M+Dz7vzkBGzXdodizbgLXGXKXlcQLA28=";
        };
        boltstart = {
          url = "https://cache.boltstart.dev";
          key = "ncps-1:Vql6Qg9lkuACGNzeRg1DsOgNZWSaooQqIz/MujHuy8k=";
        };
        numtide = {
          url = "https://cache.numtide.com";
          key = "niks3.numtide.com-1:DTx8wZduET09hRmMtKdQDxNNthLQETkc/yaX7M4qK0g=";
        };
        raspberrypi = {
          url = "https://nixos-raspberrypi.cachix.org";
          key = "nixos-raspberrypi.cachix.org-1:4iMO9LXa8BqhU+Rpg6LQKiGa2lsNh/j2oiYLNOQ5sPI=";
        };
      };

      workspaces = {
        me = {
          path = "~/evl";
          sessionName = "Me";
        };
        work = {
          path = "~/w1";
          sessionName = "Work";
        };
      };

      packageOverrides = {
        atuin = {
          version = "18.4.0";
          src = {
            owner = "atuinsh";
            repo = "atuin";
            hash = "sha256-P/q4XYhpXo9kwiltA0F+rQNSlqI+s8TSi5v5lFJWJ/4=";
          };
          cargoDeps.hash = "sha256-mrsqaqJHMyNi3yFDIyAXFBS+LY71VWXE8O7mjvgI6lo=";
        };
        discord = {
          withVencord = true;
          withOpenASAR = true;
        };
      };

      mail.r17x = {
        himalaya.enable = true;
        primary = true;
        userName = "r17x666";
        address = "r17x666@icloud.com";
        realName = "Rin";
        maildir.path = "r17x";
        passwordCommand = "pass show r17x/icloud.app.password";
        imap = {
          host = "imap.mail.me.com";
          port = 993;
          tls.enable = true;
        };
        smtp = {
          host = "smtp.mail.me.com";
          port = 587;
          tls.enable = true;
          tls.useStartTls = true;
        };
      };

      git.urlRewrites = {
        "git@gitlab.com:" = "https://gitlab.com/";
        "git@bitbucket.org:" = "https://bitbucket.org/";
      };
    };

    hosts = {
      eR17 = {
        system = "aarch64-darwin";

        apps.masApps = {
          Vimari = 1480933944;
          WhatsApp = 310633997;
        };
      };

      eR17x = {
        extends = "eR17";

        builder = {
          diskSize = 40 * 1024;
          memorySize = 8 * 1024;
          cores = 6;
          maxJobs = 4;
          systems = [
            "x86_64-linux"
            "aarch64-linux"
          ];
        };

        dns = {
          dnscrypt = {
            bootstrap_resolvers = [
              "1.1.1.1:53"
              "9.9.9.9:53"
            ];
            netprobe_timeout = 15;
            lb_strategy = "first";
            server_names = [
              "adguard-dns"
              "adguard-dns-doh"
              "cloudflare"
              "cloudflare-security"
            ];
            sources.public-resolvers = {
              cache_file = "public-resolvers.md";
              minisign_key = "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
              refresh_delay = 72;
              prefix = "";
              urls = [
                "https://raw.githubusercontent.com/DNSCrypt/dnscrypt-resolvers/master/v3/public-resolvers.md"
                "https://download.dnscrypt.info/resolvers-list/v3/public-resolvers.md"
                "https://ipv6.download.dnscrypt.info/resolvers-list/v3/public-resolvers.md"
              ];
            };
            sources.relays = {
              urls = [
                "https://raw.githubusercontent.com/DNSCrypt/dnscrypt-resolvers/master/v3/relays.md"
                "https://download.dnscrypt.info/resolvers-list/v3/relays.md"
                "https://ipv6.download.dnscrypt.info/resolvers-list/v3/relays.md"
              ];
              cache_file = "relays.md";
              minisign_key = "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
              refresh_delay = 72;
              prefix = "";
            };
          };
          unbound = {
            cache-min-ttl = 3600;
            cache-max-ttl = 86400;
            msg-cache-size = "50m";
            rrset-cache-size = "100m";
          };
        };

        mesh = {
          enable = false;
          peers = [ "tls://cgk01.edgy.direct.id:54321" ];
          publicKey = "22e1d2156e4984696caba8d95fa110e54efc09d1dee0e816d1011dd2d4dd5038";
          settings = {
            PrivateKey = "ff95a9e5095e6324bd90632550b0b19b34629b4eecdb4b66646214f4ffe05eca22e1d2156e4984696caba8d95fa110e54efc09d1dee0e816d1011dd2d4dd5038";
            IfName = "auto";
            IfMTU = 65535;
            NodeInfoPrivacy = false;
          };
        };
      };
    };

    services = {
      ollama = {
        models = [ "deepseek-r1:1.5b" ];
        dataDir = "$HOME/.process-compose/ai/data/ollamaX";
      };
      mysql = {
        m1 = {
          package = "mariadb_114";
          port = 3307;
        };
        m2 = {
          package = "mariadb_1011";
          port = 3308;
        };
        m3 = {
          package = "mariadb_106";
          port = 3309;
        };
      };
    };
  };
}
