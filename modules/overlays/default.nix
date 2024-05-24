{ inputs, ... }:

{
  flake.overlays.default = final: prev: {

    tree-sitter-grammars.tree-sitter-rescript = prev.tree-sitter.buildGrammar {
      version = inputs.ts-rescript.lastModifiedDate;
      language = "rescript";
      generate = true;
      src = inputs.ts-rescript;
    };

    vimPlugins = prev.vimPlugins.extend (_: _: { } //
      (import ./mkFlake2VimPlugin.nix inputs { pkgs = prev; })
    );
  }
  // (import ./mac-pkgs final prev)
  ;
}
