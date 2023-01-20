{ pkgs, ... }:

let
  # a high-order-function for make android sdk with specific versions tools
  # such a plaftorm-andrid-X, build-tools-X, or system-images-android-X.
  #
  # mkAndroidSdk -------------------------------------------------------{{{
  mkAndroidSdk = version: s: [
    s.ndk-bundle
    s.emulator
    s.cmdline-tools-latest
    s.tools
    s.platform-tools
    s."platforms-android-${version}"
    # platforms-android-30
    # build system tools for android related 
    s."build-tools-${version}-0-0"
    # build-tools-32-0-0
    # patch
    s.patcher-v4
    # see here: https://github.com/tadfisher/android-nixpkgs/blob/1d27f12eb37772b0ae1354e68a898f71394c28e4/channels/stable/default.nix#L7162 
    # android for create avd and use in emulator
    # system-images-android-30-google-apis-x86-64
    # system-images-android-30-google-apis-playstore-arm64-v8a
    # platforms-android-30
    s."system-images-android-${version}-google-apis-playstore-arm64-v8a"
    s.extras-google-google-play-services
  ];

  # }}}

  # this function for make nodejs development environments with includes
  # pnpm, yarn, and node.
  mkNodejs = { nodejs, withNodePackages ? _: [ ], buildInputs ? [ ] }:
    let
      nodePackages = pkgs.nodePackages.override {
        inherit nodejs;
      };
      packages = [ nodejs ]
        ++ (withNodePackages nodePackages);
    in
    pkgs.mkShell {
      inherit packages;
      inherit buildInputs;
    };
in

with pkgs;

rec {

  # Android development environments ------------------- {{{
  #
  # `nix develop my#android29` 
  android29 = mkShell {
    buildInputs = [
      (androidSdk (mkAndroidSdk "29"))
      gradle
      jdk11
    ];
  };

  # `nix develop my#android31` 
  android31 = mkShell {
    buildInputs = [
      (androidSdk (mkAndroidSdk "31"))
      gradle
      jdk11
    ];
  };

  # }}}

  # Nodejs development environments ------------------- {{{
  # this node version based on nixpkgs
  # version, shown in search.nixos.org
  # `nix develop my#node` 
  node = mkNodejs {
    inherit nodejs;
    withNodePackages = p: [
      p.yarn
    ];
  };

  # `nix develop my#node14` 
  node14 = mkNodejs {
    nodejs = nodejs-14_x;
    withNodePackages = p: [
      p.yarn
    ];
    buildInputs = [ python3 ];
  };

  # `nix develop my#eFnode` 
  eFnode = mkNodejs {
    nodejs = nodejs-14_x;
    withNodePackages = p: [
      (p.pnpm.override {
        version = "5.18.7";
        src = pkgs.fetchurl {
          url = "https://registry.npmjs.org/pnpm/-/pnpm-5.18.7.tgz";
          sha512 = "7LSLQSeskkDtzAuq8DxEcVNWlqFd0ppWPT6Z4+TiS8SjxGCRSpnCeDVzwliAPd0hedl6HuUiSnDPgmg/kHUVXw==";
        };
      })

    ];
    buildInputs = [ python3 ];
  };

  # `nix develop my#node16` 
  node16 = mkNodejs {
    nodejs = nodejs-16_x;
    withNodePackages = p: [ p.yarn ];
  };

  # `nix develop my#node18` 
  node18 = mkNodejs {
    nodejs = nodejs-18_x;
    withNodePackages = p: [ p.yarn ];
  };

  # }}}

  # Rust 🦀 development environments ------------------- {{{
  # `nix develop my#rust`
  rust = mkShell {
    buildInputs = [
      (rust-bin.stable.latest.minimal.override {
        extensions = [ "rustc" ];
      })
    ];
  };

  # `nix develop my#rust-wasm`  
  rust-wasm = mkShell {
    buildInputs = [
      (rust-bin.stable.latest.minimal.override {
        extensions = [ "rustc" ];
        targets = [ "wasm32-wasi" ];
      })
    ];
  };

  # }}}

  # Lua development environments ---------------------- {{{

  lua = mkShell {
    buildInputs = [
      luajit
      luajitPackages.luafun
    ];
  };

  # }}}
}

# vim: foldmethod=marker
