{ den, ... }:
{
  den.aspects.network = {
    includes = with den.aspects.network.provides; [
      dns-options
      dns
      mesh-options
      mesh
    ];

    provides.dns-options = {
      darwin =
        { lib, pkgs, ... }:
        {
          options.services.unbound = {
            enable = lib.mkOption {
              type = lib.types.bool;
              default = false;
            };

            package = lib.mkOption {
              type = lib.types.path;
              default = pkgs.unbound;
              defaultText = "pkgs.unbound";
            };

            settings = lib.mkOption {
              type = lib.types.attrs;
            };
          };
        };
    };

    provides.dns = {
      darwin =
        {
          user,
          config,
          lib,
          pkgs,
          ...
        }:
        let
          cfg = config.services.unbound;
          dnsCfg = user.dns;

          format.generate =
            name: value:
            lib.pipe value [
              (lib.generators.toINI {
                mkSectionName = name: "${name}:";
                mkKeyValue = key: value: "  ${key}: ${toString value}";
                listsAsDuplicateKeys = true;
              })
              (lib.strings.replaceStrings [ "[" "]" ] [ "" "" ])
              (pkgs.writeText name)
            ];
        in
        lib.mkIf (dnsCfg != null) {
          system.activationScripts.postActivation.text = lib.mkIf cfg.enable (
            lib.mkAfter ''
              if launchctl list | grep -q org.nixos.unbound; then
                attempts=0
                while ! /usr/bin/dig @127.0.0.1 localhost +short +timeout=1 >/dev/null 2>&1; do
                  attempts=$((attempts + 1))
                  if [ $attempts -ge 15 ]; then
                    echo "warning: unbound did not become ready after 15 attempts" >&2
                    break
                  fi
                  sleep 0.5
                done
                dscacheutil -flushcache
                killall -HUP mDNSResponder 2>/dev/null || true
              fi
            ''
          );

          environment.systemPackages = lib.mkIf cfg.enable [ cfg.package ];
          environment.etc = lib.mkIf cfg.enable {
            "resolver/localhost".text = ''
              nameserver 127.0.0.1
            '';
            "unbound/unbound.conf".source = format.generate "unbound.conf" cfg.settings;
          };
          launchd.daemons.unbound = lib.mkIf cfg.enable {
            script = ''
              ${lib.getExe' cfg.package "unbound"} -d
            '';
            serviceConfig = {
              RunAtLoad = true;
              KeepAlive = true;
            };
          };

          services.dnscrypt-proxy.settings = {
            listen_addresses = [
              "127.0.0.1:${if cfg.enable then "53000" else "53"}"
            ];
            doh_servers = true;
            dnscrypt_servers = true;
          } // dnsCfg.dnscrypt;

          services.unbound.settings = {
            server = {
              username = ''""'';
              verbosity = 1;
              interface = "127.0.0.1";
              port = 53;
              do-ip4 = "yes";
              do-ip6 = "no";
              do-udp = "yes";
              do-tcp = "yes";
              do-not-query-localhost = "no";
              access-control = "127.0.0.0/8 allow";
              num-threads = 4;
              so-reuseport = "yes";
              prefetch = "yes";
              serve-expired = "yes";
              hide-identity = "yes";
              hide-version = "yes";
              use-syslog = "yes";
            } // dnsCfg.unbound;

            forward-zone = {
              name = ''"."'';
              forward-first = "yes";
              forward-addr = [
                "127.0.0.1@53000"
              ];
            };
          };
        };
    };

    provides.mesh-options = {
      darwin =
        { lib, pkgs, ... }:
        {
          options.services.yggdrasil = {
            enable = lib.mkOption {
              type = lib.types.bool;
              default = false;
            };
            package = lib.mkOption {
              type = lib.types.path;
              default = pkgs.yggdrasil;
              defaultText = "pkgs.yggdrasil";
            };
            settings = lib.mkOption {
              type = lib.types.string;
            };
          };
        };
    };

    provides.mesh = {
      darwin =
        {
          user,
          config,
          lib,
          pkgs,
          ...
        }:
        let
          cfg = config.services.yggdrasil;
          meshCfg = user.mesh;
        in
        lib.mkIf (meshCfg != null) {
          environment.systemPackages = lib.mkIf cfg.enable [ cfg.package ];
          launchd.daemons.yggdrasil = lib.mkIf cfg.enable {
            script = ''
              ${lib.getExe' cfg.package "yggdrasil"} -useconffile ${(toString (pkgs.writeText "yggdrasil.conf" cfg.settings))}
            '';
            serviceConfig = {
              RunAtLoad = true;
              KeepAlive = true;
            };
          };

          services.yggdrasil.settings = builtins.toJSON (
            {
              Peers = meshCfg.peers;
              InterfacePeers = { };
              Listen = [ ];
              AdminListen = "none";
              MulticastInterfaces = [
                {
                  Regex = "en.*";
                  Beacon = true;
                  Listen = true;
                  Port = 0;
                }
                {
                  Regex = "bridge.*";
                  Beacon = true;
                  Listen = true;
                  Port = 0;
                }
              ];
              AllowedPublicKeys = [ ];
              PublicKey = meshCfg.publicKey;
              NodeInfo = { };
            }
            // meshCfg.settings
          );
        };
    };
  };
}
