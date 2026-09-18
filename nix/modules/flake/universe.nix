{
  perSystem =
    { pkgs, ... }:
    let
      # ============================================================
      # Nushell command modules
      # ============================================================
      switchCommands = import ./universe/switch.nix { };

      serviceCommands =
        if pkgs.stdenv.isDarwin then
          import ./universe/service/darwin.nix
        else
          import ./universe/service/linux.nix;

      identityCommands = import ./universe/identity.nix {
        inherit (pkgs) sops jq gnupg;
      };

      # ============================================================
      # Final Universe CLI (Nushell)
      # ============================================================
      universe = pkgs.writers.writeNuBin "universe" ''
        ${switchCommands}
        ${serviceCommands}
        ${identityCommands}

        def "main switch" [...args: string] {
          cmd_switch_dispatch ...$args
        }

        def "main state" [...args: string] {
          cmd_state_dispatch ...$args
        }

        def "main identity" [...args: string] {
          $env.FLAKE_ROOT = ($env.FLAKE_ROOT? | default (pwd))
          $env.SECRETS_FILE = $"($env.FLAKE_ROOT)/secrets/secret.yaml"
          cmd_identity_dispatch ...$args
        }

        def "main service" [...args: string] {
          cmd_service_dispatch ...$args
        }

        def "main rebuild" [...args: string] {
          let flake_root = ($env.FLAKE_ROOT? | default (pwd))
          print "==> Running darwin-rebuild switch..."
          ^sudo darwin-rebuild switch --flake $flake_root ...$args
        }

        def main [] {
          print "Usage: universe <command> [options]"
          print ""
          print "Commands:"
          print "  switch      Switch themes at runtime"
          print "  state       Show or sync current theme state"
          print "  identity    Manage GPG identities for git"
          print "  rebuild     Run darwin-rebuild switch"
          print "  service     Manage system services"
          print ""
          print "Run 'universe <command> --help' for more information."
        }
      '';
    in
    {
      packages.universe = universe;
      packages.default = universe;
      apps.universe = {
        type = "app";
        program = "${universe}/bin/universe";
      };
    };
}
