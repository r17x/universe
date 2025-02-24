{
  inputs,
  ...
}:
{
  imports = [
    { inherit (inputs.self) nixpkgs; }
  ];
}
