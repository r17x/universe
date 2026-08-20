{
  lib,
  bun2nix,
  fff-nvim,
  ...
}:
bun2nix.mkDerivation {
  packageJson = ../../apps/anakmagang/package.json;

  src = lib.fileset.toSource {
    root = ../../apps/anakmagang;
    fileset = lib.fileset.unions [
      (lib.fileset.difference ../../apps/anakmagang/src (
        lib.fileset.fileFilter (f: lib.hasSuffix ".test.ts" f.name) ../../apps/anakmagang/src
      ))
      ../../apps/anakmagang/build.ts
      ../../apps/anakmagang/package.json
      ../../apps/anakmagang/tsconfig.json
      ../../apps/anakmagang/bun.lock
    ];
  };

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ../../apps/anakmagang/bun.nix;
  };

  buildPhase = ''
    runHook preBuild
    OUTFILE=./out/anakmagang bun run build.ts
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin
    cp out/anakmagang $out/bin/
    runHook postInstall
  '';

  dontRunLifecycleScripts = true;

  nativeBuildInputs = [ fff-nvim ];

  LIBFFF_PATH = "${fff-nvim}/lib";
}
