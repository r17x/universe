{ ... }:
{
  flake.commonModules = {
    system-shells = import ./shells.nix;
    users-primaryUser = import ./user.nix;
  };

  flake.darwinModules = {
    dnscrypt-proxy = import ./darwin/dnscrypt-proxy.nix;
    system-darwin = import ./darwin/system.nix;
    system-darwin-packages = import ./darwin/packages.nix;
    system-darwin-gpg = import ./darwin/gpg.nix;
    system-darwin-window-manager = import ./darwin/mouseless.nix;
    system-darwin-homebrew = import ./darwin/homebrew.nix;
    system-darwin-network = import ./darwin/network.nix;
  };
}
