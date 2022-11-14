{ pkgs, lib, ... }:

let
  recursiveMergeAttrs = listOfAttrsets: lib.fold (attrset: acc: lib.recursiveUpdate attrset acc) { } listOfAttrsets;

  shellEnv = import ./shellEnv.nix { inherit pkgs; };
  yarnOverride = { nodejs }: pkgs.yarn.overrideAttrs (oldAttrs: {
    buildInputs = [ nodejs ];
  });

  pkgsPnpm_5_18_10 = { nodejs }:
    (pkgs.nodePackages.pnpm.override {
      version = "5.18.10";
      src = fetchurl {
        url = "https://registry.npmjs.org/pnpm/-/pnpm-5.18.10.tgz";
        sha512 = "M3oH42XqtUZv0Hnfp4A1klTFQT3/9ghBkDrPHh0GTd9nP39I14/GDjN+BiHx95hH60CigOip+oK/h389GhizeQ==";
      };
    });

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

    pnpm = mkShell {
      packages = [
        nodePackages.pnpm
      ];
    };

    pnpm5 = mkShell {
      packages = [
        (nodePackages.pnpm.override {
          version = "5.18.7";
          src = fetchurl {
            url = "https://registry.npmjs.org/pnpm/-/pnpm-5.18.7.tgz";
            sha512 = "7LSLQSeskkDtzAuq8DxEcVNWlqFd0ppWPT6Z4+TiS8SjxGCRSpnCeDVzwliAPd0hedl6HuUiSnDPgmg/kHUVXw==";
          };
        })
      ];
    };

    pnpm5_18_10 = mkShell {
      packages = [
        pkgsPnpm_5_18_10
      ];
    };

    node14 = mkShell {
      buildInputs = [ python27 ];
      packages = [
        nodejs-14_x
        (yarnOverride {
          nodejs = nodejs-14_x;
        })
        (
          pkgsPnpm_5_18_10 {
            nodejs = nodejs-14_x;
          }
        )
      ];
    };

    node16 = mkShell
      {
        buildInputs = [ python27 ];
        packages = [
          nodejs-16_x
          (yarnOverride {
            nodejs = nodejs-16_x;
          })
        ];
      };

    node18 = mkShell
      {
        packages = [
          nodejs-18_x
          (yarnOverride {
            nodejs = nodejs-18_x;
          })
        ];
      };

    go = mkShell
      { packages = [ go ]; };

    # go16 = mkShell
    #   {
    #     packages = [
    #       (go.overrideAttrs (oldAttrs: rec {
    #         version = "1.16.5";

    #         src = fetchurl {
    #           url = "https://dl.google.com/go/go${version}.src.tar.gz";
    #           sha256 = "sha256-e/p+WQjHzJ512l3fMGbXy88/2fpRlFhRMl7rwX9QuoA=";
    #         };
    #       }))
    #     ];
    #   };
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

  devShellsConfigurations = [ useNixShell ] ++ lib.attrsets.mapAttrsToList
    toWriteShell
    devShells;

in

recursiveMergeAttrs
  devShellsConfigurations
