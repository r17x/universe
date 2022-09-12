{ ... }:
{
  # Auto upgrade nix package and the daemon service.
  services.nix-daemon.enable = true;
  security.pam.enableSudoTouchIdAuth = false;
}
