{ inputs, ... }:
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
        services.ollama.ollamaX.dataDir = "$HOME/.process-compose/ai/data/ollamaX";
        services.ollama.ollamaX.models = [ "deepseek-r1:1.5b" ];
      };

      process-compose."mysql" = {
        imports = [
          inputs.services-flake.processComposeModules.default
        ];
        services.mysql."m1" = {
          enable = true;
          package = pkgs.mariadb_114;
          settings.mysqld.port = 3307;
        };
        services.mysql."m2" = {
          enable = true;
          package = pkgs.mariadb_1011;
          settings.mysqld.port = 3308;
        };
        services.mysql."m3" = {
          enable = true;
          package = pkgs.mariadb_106;
          settings.mysqld.port = 3309;
        };
      };
    };

  den.aspects.services = { };
}
