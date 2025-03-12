{ ocamlPackages }:

ocamlPackages.buildDunePackage {
  pname = "norg";
  version = "0.0.0";
  src = ../../apps/norg;

  buildInputs = with ocamlPackages; [
    angstrom
  ];
}
