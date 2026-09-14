{
  lib,
  inputs,
  ...
}:

let
  diagramLib = import "${inputs.den-diagram}/nix" { inherit lib; };

  edgePalette = {
    base00 = "#1A1A2E";
    base01 = "#16213E";
    base02 = "#2B2D3A";
    base03 = "#8A8A9E";
    base04 = "#B8C0D0";
    base05 = "#E1E5ED";
    base06 = "#F0F2F5";
    base07 = "#FFFFFF";
    base08 = "#EC7279";
    base09 = "#EF9F76";
    base0A = "#DBBE80";
    base0B = "#A0C980";
    base0C = "#5DBBC1";
    base0D = "#6CB6EB";
    base0E = "#D38AEA";
    base0F = "#B87AD8";
  };

  theme = diagramLib.themeFromPalette edgePalette;

  mkEntry =
    {
      name,
      parent ? null,
      class ? "",
      hasClass ? (class != ""),
      isProvider ? false,
      provider ? [ ],
      ...
    }@args:
    {
      inherit
        name
        parent
        class
        hasClass
        isProvider
        provider
        ;
      excluded = false;
      replacedBy = null;
      handlers = [ ];
      hasAdapter = false;
      isParametric = false;
      fnArgNames = [ ];
      entityKind = args.entityKind or null;
      entityInstance = args.entityInstance or null;
    };

  callgraphEntries = [
    (mkEntry {
      name = "flake.nix";
      class = "entry";
    })
    (mkEntry {
      name = "nix/default.nix";
      parent = "flake.nix";
      class = "entry";
    })

    (mkEntry {
      name = "colors.nix";
      parent = "nix/default.nix";
      class = "shared";
    })
    (mkEntry {
      name = "icons.nix";
      parent = "nix/default.nix";
      class = "shared";
    })

    (mkEntry {
      name = "eR17.nix";
      parent = "nix/default.nix";
      class = "config";
    })
    (mkEntry {
      name = "eR17x.nix";
      parent = "eR17.nix";
      class = "config";
    })
    (mkEntry {
      name = "r17.nix";
      parent = "nix/default.nix";
      class = "config";
    })
    (mkEntry {
      name = "vm.nix";
      parent = "nix/default.nix";
      class = "config";
    })

    (mkEntry {
      name = "cross/nix.nix";
      parent = "eR17.nix";
      class = "cross";
    })
    (mkEntry {
      name = "cross/nixpkgs.nix";
      parent = "eR17.nix";
      class = "cross";
    })
    (mkEntry {
      name = "cross/shells.nix";
      parent = "eR17.nix";
      class = "cross";
    })

    (mkEntry {
      name = "darwin/system.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/gpg.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/home-manager.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/homebrew.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/packages.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/mouseless.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/network.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/unbound.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/yggdrasil.nix";
      parent = "eR17.nix";
      class = "darwin";
    })
    (mkEntry {
      name = "darwin/linux-builder.nix";
      parent = "eR17.nix";
      class = "darwin";
    })

    (mkEntry {
      name = "home/activation.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/git.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/gpg.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/mail.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/packages.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/pass.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/shells.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/terminal.nix";
      parent = "r17.nix";
      class = "home";
    })
    (mkEntry {
      name = "home/tmux.nix";
      parent = "r17.nix";
      class = "home";
    })

    (mkEntry {
      name = "flake/module-config.nix";
      parent = "nix/default.nix";
      class = "flake";
    })
    (mkEntry {
      name = "flake/pkgs-by-name.nix";
      parent = "nix/default.nix";
      class = "flake";
    })
    (mkEntry {
      name = "flake/rebuild-script.nix";
      parent = "nix/default.nix";
      class = "flake";
    })
    (mkEntry {
      name = "flake/universe.nix";
      parent = "nix/default.nix";
      class = "flake";
    })

    (mkEntry {
      name = "overlays/default.nix";
      parent = "nix/default.nix";
      class = "overlay";
    })
    (mkEntry {
      name = "overlays/lib.nix";
      parent = "overlays/default.nix";
      class = "overlay";
    })
    (mkEntry {
      name = "overlays/mkFlake2VimPlugin.nix";
      parent = "overlays/default.nix";
      class = "overlay";
    })
    (mkEntry {
      name = "overlays/mac-pkgs";
      parent = "overlays/default.nix";
      class = "overlay";
    })
    (mkEntry {
      name = "overlays/ocamlPackages";
      parent = "overlays/default.nix";
      class = "overlay";
    })
    (mkEntry {
      name = "overlays/nodePackages";
      parent = "overlays/default.nix";
      class = "overlay";
    })

    (mkEntry {
      name = "nvim.nix";
      parent = "nix/default.nix";
      class = "nvim";
    })

    (mkEntry {
      name = "packages/hud-colorschemes";
      parent = "overlays/default.nix";
      class = "package";
    })
    (mkEntry {
      name = "packages/sketchybar";
      parent = "overlays/mac-pkgs";
      class = "package";
    })

    (mkEntry {
      name = "devShells.nix";
      parent = "nix/default.nix";
      class = "devshell";
    })
  ];

  callgraph = diagramLib.graph.build {
    rootName = "universe";
    direction = "TD";
    entries = callgraphEntries;
  };

  renderers = diagramLib.renderers { inherit theme; };
  mermaidSource = renderers.toMermaid callgraph;
  jsonSource = diagramLib.toJSON callgraph;

in
{
  perSystem =
    { pkgs, ... }:
    {
      packages = {
        diagrams-mermaid = pkgs.writeText "nix-callgraph.mmd" mermaidSource;

        diagrams-json = pkgs.runCommand "nix-callgraph.json" { nativeBuildInputs = [ pkgs.jq ]; } ''
          echo ${lib.escapeShellArg jsonSource} | jq . > $out
        '';

        diagrams-svg =
          pkgs.runCommand "nix-callgraph.svg"
            {
              nativeBuildInputs = [ pkgs.nodePackages.mermaid-cli ];
            }
            ''
              echo ${lib.escapeShellArg mermaidSource} > input.mmd
              mmdc -i input.mmd -o $out -t dark -b transparent 2>/dev/null || cp input.mmd $out
            '';

        write-diagrams =
          let
            entries = [
              {
                name = "callgraph";
                ext = "mmd";
                drv = pkgs.writeText "callgraph.mmd" mermaidSource;
              }
              {
                name = "callgraph";
                ext = "json";
                drv = pkgs.runCommand "callgraph.json" { nativeBuildInputs = [ pkgs.jq ]; } ''
                  echo ${lib.escapeShellArg jsonSource} | jq . > $out
                '';
              }
            ];
          in
          pkgs.writeShellScriptBin "write-diagrams" ''
            set -euo pipefail
            dest="$(${pkgs.git}/bin/git rev-parse --show-toplevel)"
            mkdir -p "$dest/diagrams"
            ${lib.concatMapStringsSep "\n" (e: ''cat ${e.drv} > "$dest/diagrams/${e.name}.${e.ext}"'') entries}
            echo "Wrote ${toString (builtins.length entries)} diagram files to $dest/diagrams/"
          '';
      };
    };
}
