{
  config,
  lib,
  inputs,
  ...
}:

let
  den = config.den;
  diagramLib = import "${inputs.den-diagram}/nix" { inherit lib; };

  theme = diagramLib.themeFromPalette inputs.self.color.scheme;
  renderers = diagramLib.renderers { inherit theme; };

  # --- Auto-discovery ---

  fleetCapture = den.lib.capture.captureFleet { };
  allHosts = lib.concatMap builtins.attrValues (builtins.attrValues den.hosts);

  namespaceGraph = diagramLib.graph.ofNamespace { aspects = den.aspects or { }; };

  # --- 1. Overview: simplified namespace ---
  overviewMermaid = renderers.toMermaid (diagramLib.graph.simplified namespaceGraph);

  # --- 2. Per-host: projected from fleet capture ---
  hostSections = map (
    host:
    let
      graph = diagramLib.projectScope {
        inherit fleetCapture;
        kind = "host";
        name = host.name;
      };
    in
    {
      name = host.name;
      mermaid = renderers.toMermaid (diagramLib.graph.simplified graph);
    }
  ) allHosts;

  # --- 3. Per-user (Home Manager): projected from fleet capture ---
  allUserNames = lib.unique (lib.concatMap (host: builtins.attrNames (host.users or { })) allHosts);

  userSections = map (
    userName:
    let
      graph = diagramLib.projectScope {
        inherit fleetCapture;
        kind = "user";
        name = userName;
      };
    in
    {
      name = userName;
      mermaid = renderers.toMermaid graph;
    }
  ) allUserNames;

  # --- N. Dependencies: full namespace graph ---
  depsMermaid = renderers.toMermaid namespaceGraph;

  textLib = diagramLib.text;

  darwinCapture = den.lib.capture.captureFleet { class = "darwin"; };
  hmCapture = den.lib.capture.captureFleet { class = "homeManager"; };

  darwinFleetText = textLib.fleetSummary darwinCapture;
  hmFleetText = textLib.fleetSummary hmCapture;

  darwinHostTexts = map (
    host:
    let
      graph = diagramLib.projectScope {
        fleetCapture = darwinCapture;
        kind = "host";
        name = host.name;
      };
    in
    textLib.hostSummary {
      inherit graph;
      fleetCapture = darwinCapture;
    }
  ) allHosts;

  hmHostTexts = map (
    host:
    let
      graph = diagramLib.projectScope {
        fleetCapture = hmCapture;
        kind = "host";
        name = host.name;
      };
    in
    textLib.hostSummary {
      inherit graph;
      fleetCapture = hmCapture;
    }
  ) allHosts;

  fullSummary = lib.concatStringsSep "\n\n---\n\n" (
    [ darwinFleetText ] ++ darwinHostTexts ++ [ hmFleetText ] ++ hmHostTexts
  );

  # --- README section composition ---
  mermaidBlock = src: "```mermaid\n${src}\n```";

  collapsible = title: content: ''
    <details>
    <summary>${title}</summary>

    ${content}

    </details>'';

  readmeSection = lib.concatStringsSep "\n\n" (
    [
      "### Overview"
      (mermaidBlock overviewMermaid)
      "### Hosts"
    ]
    ++ map (h: collapsible h.name (mermaidBlock h.mermaid)) hostSections
    ++ [ "### Home Manager" ]
    ++ map (u: collapsible u.name (mermaidBlock u.mermaid)) userSections
    ++ [
      "### Dependencies"
      (mermaidBlock depsMermaid)
    ]
  );

in
{
  perSystem =
    { pkgs, ... }:
    let
      sectionDrv = pkgs.writeText "readme-section.md" readmeSection;
    in
    {
      packages = {
        diagrams-mermaid = pkgs.writeText "architecture.mmd" overviewMermaid;

        diagrams-json = pkgs.runCommand "architecture.json" { nativeBuildInputs = [ pkgs.jq ]; } ''
          echo ${lib.escapeShellArg (diagramLib.toJSON namespaceGraph)} | jq . > $out
        '';

        diagrams-svg =
          pkgs.runCommand "architecture.svg" { nativeBuildInputs = [ pkgs.nodePackages.mermaid-cli ]; }
            ''
              echo ${lib.escapeShellArg overviewMermaid} > input.mmd
              mmdc -i input.mmd -o $out -t dark -b transparent 2>/dev/null || cp input.mmd $out
            '';

        graph = pkgs.writeShellScriptBin "graph" ''
          cat ${pkgs.writeText "graph.md" fullSummary}
        '';

        update-readme = pkgs.writeShellScriptBin "update-readme" ''
          set -euo pipefail
          ROOT="$(${pkgs.git}/bin/git rev-parse --show-toplevel)"
          README="$ROOT/README.md"

          if [ ! -f "$README" ]; then
            cat > "$README" <<'HEADER'
          # Universe

          > ri7's declarative system configuration via [den](https://github.com/denful/den) aspects

          <!-- BEGIN:AUTO-GENERATED -->
          <!-- END:AUTO-GENERATED -->
          HEADER
          fi

          BEFORE=$(${pkgs.gnused}/bin/sed '/<!-- BEGIN:AUTO-GENERATED -->/q' "$README")
          AFTER=$(${pkgs.gnused}/bin/sed -n '/<!-- END:AUTO-GENERATED -->/,$p' "$README")

          {
            printf '%s\n\n' "$BEFORE"
            cat ${sectionDrv}
            printf '\n\n%s\n' "$AFTER"
          } > "$README.tmp"

          mv "$README.tmp" "$README"
        '';
      };
    };
}
