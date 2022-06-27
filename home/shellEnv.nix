# Ref https://github.com/vic/mk-darwin-system/blob/main/lib/shell-env.nix
{pkgs}: shell:
pkgs.runCommandLocal "${shell.name}-shell-env.bash" {
  shell_input_derivation = shell.inputDerivation;
} (builtins.readFile ./shell-env.bash)
