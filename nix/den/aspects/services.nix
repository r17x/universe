{
  config,
  inputs,
  lib,
  ...
}:
let
  services = lib.foldl' lib.recursiveUpdate { } (
    map (profile: profile.services) (lib.attrValues config.den.profiles)
  );
in
{
  imports = [
    inputs.process-compose-flake.flakeModule
  ];

  perSystem =
    { pkgs, ... }:
    {
      process-compose."ai" = {
        imports = [
          inputs.services-flake.processComposeModules.default
        ];
        services.ollama.ollamaX.enable = true;
        services.ollama.ollamaX.dataDir = services.ollama.dataDir;
        services.ollama.ollamaX.models = services.ollama.models;
      };

      process-compose."mysql" = {
        imports = [
          inputs.services-flake.processComposeModules.default
        ];
        services.mysql = lib.mapAttrs (_: mysql: {
          enable = true;
          package = pkgs.${mysql.package};
          settings.mysqld.port = mysql.port;
        }) services.mysql;
      };
    };

  den.aspects.services = { };
}
