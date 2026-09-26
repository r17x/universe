{
  lib,
  inputs,
  pkgs,
  ...
}:

let
  rust-bin = (pkgs.extend inputs.rust-overlay.overlays.default).rust-bin;
  rustToolchain = rust-bin.stable."1.91.0".default;
  craneLib = (inputs.crane.mkLib pkgs).overrideToolchain rustToolchain;

  src = lib.cleanSourceWith {
    src = craneLib.path "${inputs.self}/apps/ucgw";
    filter =
      path: type: (craneLib.filterCargoSources path type) || (builtins.match ".*\.toml$" path != null);
  };

  commonArgs = {
    inherit src;
    pname = "ucgw";
    version = "0.1.0";
    strictDeps = true;

    nativeBuildInputs = with pkgs; [
      pkg-config
    ];

    buildInputs =
      with pkgs;
      [ ]
      ++ lib.optionals stdenv.isLinux [
        udev
      ]
      ++ lib.optionals stdenv.isDarwin (
        with darwin.apple_sdk.frameworks;
        [
          Security
          SystemConfiguration
          CoreFoundation
          IOKit
        ]
      );
  };

  cargoArtifacts = craneLib.buildDepsOnly commonArgs;
in
craneLib.buildPackage (
  commonArgs
  // {
    inherit cargoArtifacts;
    cargoExtraArgs = "--bin gw-daemon";

    meta = {
      description = "USB Cellular Tethering Gateway";
      license = with lib.licenses; [
        mit
        asl20
      ];
      mainProgram = "gw-daemon";
    };
  }
)
