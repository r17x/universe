{ lib, ... }:
let
  types = import ./types.nix { inherit lib; };
in
{
  den.schema.user.imports = [ types.userModule ];
}
