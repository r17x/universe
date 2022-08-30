{ pkgs, lib, ... }:

let
  recursiveMergeAttrs = listOfAttrsets: lib.fold (attrset: acc: lib.recursiveUpdate attrset acc) { } listOfAttrsets;

  shellEnv = import ./shellEnv.nix { inherit pkgs; };
  # for use devShell
  # write a file .envrc in some directory with contents:
  # use nix-envs [devShell_Name]
  #
  # for [devShell_Name] see the attributes set of devShells
  # you can combine one or many devShell on environment, example:
  # use nix-env go node14
  devShells = with pkgs; {
    android =
      let
        android-sdk = androidSdk (sdkPkgs: with sdkPkgs; [
          cmdline-tools-latest
          build-tools-32-0-0
          platform-tools
          platforms-android-30
          emulator
          # see here: https://github.com/tadfisher/android-nixpkgs/blob/1d27f12eb37772b0ae1354e68a898f71394c28e4/channels/stable/default.nix#L7162 
          system-images-android-30-google-apis-x86-64
          system-images-android-30-google-apis-playstore-arm64-v8a
        ]);
      in
      mkShell {
        buildInputs = [ android-sdk ];
        packages = [ jre8 ];
      };

    node14 = mkShell {
      buildInputs = [ python27 ];
      packages = [ nodejs-14_x nodePackages.yarn ];
    };

    node16 = mkShell {
      buildInputs = [ python27 ];
      packages = [ nodejs-16_x nodePackages.yarn ];
    };

    node18 = mkShell {
      packages = [ nodejs-18_x nodePackages.yarn ];
    };

    go = mkShell { packages = [ go ]; };

    go16 = mkShell {
      packages = [
        (go.overrideAttrs (oldAttrs: rec {
          version = "1.16.5";

          src = fetchurl {
            url = "https://dl.google.com/go/go${version}.src.tar.gz";
            sha256 = "sha256-e/p+WQjHzJ512l3fMGbXy88/2fpRlFhRMl7rwX9QuoA=";
          };
        }))
      ];
    };
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

  devShellsConfigurations = [ useNixShell ] ++ lib.attrsets.mapAttrsToList toWriteShell devShells;

in

recursiveMergeAttrs devShellsConfigurations
