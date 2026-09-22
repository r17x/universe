{
  lib,
  writers,
  libfido2,
  yubikey-manager,
  pcsc-tools,
  expect,
  openssl,
  coreutils,
  gnupg,
  picotool,
  inputs,
  ...
}:

let
  deps = lib.makeBinPath [
    libfido2
    yubikey-manager
    pcsc-tools
    expect
    openssl
    coreutils
    gnupg
    picotool
  ];
in
writers.writeNuBin "r17c" (
  ''
    $env.PATH = ($env.PATH | prepend ("${deps}" | split row ":"))
  ''
  + builtins.readFile "${inputs.self}/apps/r17c/r17c.nu"
)
