{ inputs, ... }:
{
  perSystem =
    { pkgs, system, ... }:
    let
      bun2nix = inputs.bun2nix.packages.${system}.bun2nix;
    in
    {
      packages.anakmagang = bun2nix.mkDerivation {
        pname = "anakmagang";
        version = "0.1.0";

        src = ../apps/anakmagang;

        bunDeps = bun2nix.fetchBunDeps {
          bunNix = ../apps/anakmagang/bun.nix;
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
          cp ${pkgs.fff-nvim}/lib/libfff_c.dylib $out/bin/
          runHook postInstall
        '';

        nativeBuildInputs = [ pkgs.fff-nvim ];

        LIBFFF_PATH = "${pkgs.fff-nvim}/lib";
      };
    };
}
