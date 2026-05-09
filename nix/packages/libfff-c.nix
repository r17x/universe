{
  inputs,
  stdenv,
  lib,
  ...
}:

let
  system = stdenv.hostPlatform.system;
  fff-nvim-pkg = inputs.fff-nvim.packages.${system}.default;
  libName = if stdenv.hostPlatform.isDarwin then "libfff_c.dylib" else "libfff_c.so";
in
stdenv.mkDerivation {
  pname = "libfff-c";
  version = fff-nvim-pkg.version or "0.0.0";

  dontUnpack = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib
    cp ${fff-nvim-pkg}/lib/${libName} $out/lib/${libName}
    runHook postInstall
  '';

  meta = {
    description = "C FFI library from fff.nvim (fast file finder)";
    homepage = "https://github.com/dmtrKovalenko/fff.nvim";
    license = lib.licenses.mit;
    platforms = lib.platforms.unix;
  };
}
