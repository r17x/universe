_final: prev:
{
  tree-sitter-grammars = prev.tree-sitter-grammars // {
    tree-sitter-rescript = let rescript_src = prev.lib.importJSON ./treesitter/tree-sitter-rescript.json; in
      prev.pkgs-unstable.tree-sitter.buildGrammar {
        version = "2023-04-27";
        language = "rescript";
        generate = true;
        src = rescript_src.path;
      };
  };
}
