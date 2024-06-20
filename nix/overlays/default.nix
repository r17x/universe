{ inputs, ... }:

{
  flake.overlays.default = final: prev: {

    ocamlPackages = prev.ocaml-ng.ocamlPackages_5_2.overrideScope (ofinal: oprev: {
      quickjs = prev.callPackage ./quickjs.nix { src = inputs.quickjs-ml; } oprev;
      server-reason-react = prev.callPackage ./server-reason-react.nix { src = inputs.server-reason-react; } ofinal;
    });

    tree-sitter-grammars = prev.tree-sitter-grammars // {
      tree-sitter-rescript = prev.tree-sitter.buildGrammar {
        version = inputs.ts-rescript.lastModifiedDate;
        language = "rescript";
        generate = true;
        src = inputs.ts-rescript;
      };
    };

    vimPlugins = prev.vimPlugins.extend (_: _: { } //
      (import ./mkFlake2VimPlugin.nix inputs { pkgs = prev; })
    );
  }
  // (import ./mac-pkgs final prev)
  ;
}
