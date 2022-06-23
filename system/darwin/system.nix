{...}:
{
  # Auto upgrade nix package and the daemon service.
  services.nix-daemon.enable = true;

  users.nix.configureBuildUsers = true;
 
  # commented this line cause NOT using TouchID
  # security.pam.enableSudoTouchIdAuth = false;
}
