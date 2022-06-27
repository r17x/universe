{ pkgs, ... }:
let 
  shellEnv = import ./shellEnv.nix {inherit pkgs;};

  node14 = pkgs.mkShell { packages = [ pkgs.nodejs-14_x ]; };

  node16 = pkgs.mkShell { packages = with pkgs; [ nodejs-16_x ]; };

  node18 = pkgs.mkShell { packages = with pkgs; [ nodejs-18_x ]; };
in
{
  xdg.configFile."direnv/lib/use_nix-env.sh".text = ''
    function use_nix-env(){
      . "$HOME/.config/direnv/nix-envs/''${1}/env"
    }
  '';

  xdg.configFile."direnv/nix-envs/node14".source = shellEnv node14;
  xdg.configFile."direnv/nix-envs/node16".source = shellEnv node16;
  xdg.configFile."direnv/nix-envs/node18".source = shellEnv node18;
}
