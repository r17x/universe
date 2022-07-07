inputs: nixpkgsConfig:
let
  inherit (inputs.nixpkgs-unstable.lib) optionalAttrs singleton attrsets;
in
{
  # Overlays to add different versions `nixpkgs` into package set
  pkgs-master = final: prev: {
    pkgs-master = import inputs.nixpkgs-master {
      inherit (prev.stdenv) system;
      inherit (nixpkgsConfig) config;
    };
  };

  pkgs-stable = final: prev: {
    pkgs-stable = import inputs.nixpkgs-stable {
      inherit (prev.stdenv) system;
      inherit (nixpkgsConfig) config;
    };
  };

  pkgs-unstable = final: prev: {
    pkgs-unstable = import inputs.nixpkgs-unstable {
      inherit (prev.stdenv) system;
      inherit (nixpkgsConfig) config;
    };
  };

  # comma = final: prev: {
  #   comma = import inputs.comma { inherit (prev) pkgs; };
  # };

  # Overlay useful on Macs with Apple Silicon
  apple-silicon = final: prev: optionalAttrs (prev.stdenv.system == "aarch64-darwin") {
    # Add access to x86 packages system is running Apple Silicon
    pkgs-x86 = import inputs.nixpkgs-unstable {
      system = "x86_64-darwin";
      inherit (nixpkgsConfig) config;
    };
  };

  mac-pkgs = final: prev:
    import ./macpkgs { pkgs = prev; inherit attrsets; };

  # nodePackages = final: prev: {
  #   nodePackages = prev.nodePackages // import ./pkgs/node-packages { pkgs = prev; };
  # };

}
