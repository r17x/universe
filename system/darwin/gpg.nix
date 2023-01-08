{ ... }:

{
  programs.gnupg = {
    agent.enable = true;
    agent.enableSSHSupport = true;
  };
}
