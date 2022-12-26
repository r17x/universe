{ pkgs, lib, ... }:

let
  recursiveMergeAttrs = listOfAttrsets: lib.fold (attrset: acc: lib.recursiveUpdate attrset acc) { } listOfAttrsets;

  shellEnv = import ./shellEnv.nix { inherit pkgs; };

  makeNodeShell = { nodejs, python ? pkgs.python27 }:
    let
      nodePackages = pkgs.nodePackages.override {
        inherit nodejs;
      };
    in
    pkgs.mkShell {
      buildInputs = [ python ];
      packages = [
        nodejs
        nodePackages.yarn
        (nodePackages.pnpm.override {
          version = "5.18.7";
          src = pkgs.fetchurl {
            url = "https://registry.npmjs.org/pnpm/-/pnpm-5.18.7.tgz";
            sha512 = "7LSLQSeskkDtzAuq8DxEcVNWlqFd0ppWPT6Z4+TiS8SjxGCRSpnCeDVzwliAPd0hedl6HuUiSnDPgmg/kHUVXw==";
          };
        })
      ];
    };
  # for use devShell
  # write a file .envrc in some directory with contents:
  # use nix-env [devShell_Name]
  #
  # for [devShell_Name] see the attributes set of devShells
  # you can combine one or many devShell on environment, example:
  # use nix-env go node14
  devShells = with pkgs; {
    rust-wasm = mkShell {
      buildInputs = [
        (rust-bin.stable.latest.minimal.override {
          extensions = [ "rustc" ];
          targets = [ "wasm32-wasi" ];
        })
      ];
    };

    android31 =
      let
        android-sdk = androidSdk (sdkPkgs: with sdkPkgs; [
          ndk-bundle
          emulator
          cmdline-tools-latest
          tools
          platform-tools
          platforms-android-31
          # platforms-android-30
          # build system tools for android related 
          build-tools-30-0-2
          # build-tools-32-0-0
          # patch
          patcher-v4
          # see here: https://github.com/tadfisher/android-nixpkgs/blob/1d27f12eb37772b0ae1354e68a898f71394c28e4/channels/stable/default.nix#L7162 
          # android for create avd and use in emulator
          # system-images-android-30-google-apis-x86-64
          # system-images-android-30-google-apis-playstore-arm64-v8a
          # platforms-android-30
          system-images-android-31-google-apis-playstore-arm64-v8a
          extras-google-google-play-services
        ]);
      in
      mkShell {
        buildInputs = [ android-sdk jre8 gradle ];
      };

    android =
      let
        android-sdk = androidSdk (sdkPkgs: with sdkPkgs; [
          emulator
          cmdline-tools-latest
          tools
          platform-tools
          platforms-android-29
          # platforms-android-30
          # build system tools for android related 
          build-tools-29-0-2
          # build-tools-32-0-0
          # patch
          patcher-v4
          # see here: https://github.com/tadfisher/android-nixpkgs/blob/1d27f12eb37772b0ae1354e68a898f71394c28e4/channels/stable/default.nix#L7162 
          # android for create avd and use in emulator
          # system-images-android-30-google-apis-x86-64
          # system-images-android-30-google-apis-playstore-arm64-v8a
          # platforms-android-30
          system-images-android-29-google-apis-playstore-arm64-v8a
          extras-google-google-play-services
        ]);
      in
      mkShell {
        buildInputs = [ android-sdk jre8 gradle ];
      };

    node14 = makeNodeShell {
      nodejs = nodejs-14_x;
    };

    node16 = makeNodeShell {
      nodejs = nodejs-14_x;
    };

    node18 = makeNodeShell {
      nodejs = nodejs-18_x;
      python = python3;
    };

    go = mkShell
      { packages = [ go ]; };
  };

  useNixShell =
    {
      xdg.configFile."direnv/lib/use_nix-env.sh".text = ''
        function use_nix-env(){
          for name in $@; do
            . "$HOME/.config/direnv/nix-envs/''${name}/env"
          done
        }
      '';
    };

  toWriteShell = name: devShell: { xdg.configFile."direnv/nix-envs/${name}".source = shellEnv devShell; };

  devShellsConfigurations = [ useNixShell ]
    ++ lib.attrsets.mapAttrsToList toWriteShell devShells;

in

recursiveMergeAttrs
  devShellsConfigurations
