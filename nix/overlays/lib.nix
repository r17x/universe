_final:

lib:

{
  mkChannels =
    {
      inputs,
      nixpkgsArgs,
      prefix ? "nixpkgs-",
    }:
    lib.pipe inputs [
      (lib.filterAttrs (name: _channel: lib.strings.hasPrefix prefix name))
      (lib.mapAttrs' (
        name: channel: lib.nameValuePair (lib.strings.removePrefix prefix name) (import channel nixpkgsArgs)
      ))
    ];
}
