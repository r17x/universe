{ self, ... }:

{
  # `home-manager` modules
  flake.homeManagerModules = {
    r17-alacritty = import ./alacritty.nix;
    r17-activation = import ./activation.nix;
    r17-packages = import ./packages.nix;
    r17-shell = import ./shells.nix;
    r17-git = import ./git.nix;
    r17-tmux = import ./tmux.nix;
    r17-neovim = import ./neovim.nix;
    gpg = import ./gpg.nix;
    pass = import ./pass.nix;
    home-user-info = { lib, ... }: {
      options.home.user-info =
        (self.commonModules.users-primaryUser { inherit lib; }).options.users.primaryUser;
    };
  };
}
