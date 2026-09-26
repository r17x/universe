{ ... }:
{
  den.aspects.ucgw =
    { host, ... }:
    let
      ucgwCfg = host.ucgw or null;
    in
    {
      nixos = _: {
        imports = [ ../../../modules/nixos/ucgw.nix ];
      };

      darwin =
        { lib, pkgs, ... }:
        lib.mkIf (ucgwCfg != null && ucgwCfg.enable or false) {
          launchd.daemons.ucgw = {
            script = ''
              ${pkgs.ucgw}/bin/gw-daemon ${pkgs.writeText "ucgw.toml" (builtins.toJSON (ucgwCfg.settings or { }))}
            '';
            serviceConfig = {
              RunAtLoad = true;
              KeepAlive = true;
              StandardOutPath = "/var/log/ucgw.log";
              StandardErrorPath = "/var/log/ucgw.err.log";
            };
          };
        };
    };
}
