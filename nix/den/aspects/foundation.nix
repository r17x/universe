{ lib, inputs, ... }:
let
  icons = import ../../icons.nix;
  colors = import ../../colors.nix { inherit lib; };
  color = colors.mkColor colors.lists.edge;
in
{
  flake = {
    users.r17 = rec {
      username = "r17x";
      gh.url = "https://github.com/${username}";
      keys = [
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKvi3Co5fB1dSU2Qs1sR6LwdB1hM6HCyIWfXsC0wgz1pmeFlje24SzPCxDtsVMq28fDpEBsXPqKSZbUIyBtHRnpIc72Z8IV0KNtBjbKQTfHLTiDu43e+VLuAdFE7u2Wf5KPQIQ52r/jr9P7UKU2GKwV016OzrRiaZjm+gixmd8YRfidzG1bsL5fbKBjxCIUROdVpW5kNNtPZHpeuHCkZ7341USC6V2qnp1BNHIoHLjRYosV82apOxN/AWY/tMN2jlVQ/gKIUHbxXoILsG+XRFCen5TSSearx54KxifI1aIWbxVVmmYNuLXGWnVumaH6U7ARpz2cEXQB9z2lvJGYmod8qfloVdjXESu8OFe4RT+nj0JUQs7pMhiN6K1AsMQiyFc0ZmU2UNx4JcHre5STnSKUHUCx4zzoToFvIQRBTB3HePHy74FcXWaYDAN/6YF3JEA203nyYL4o5m/KhSXNkcT3H+r3IAqKnl7J7obsvNowwa1UB2NxVmq0VXXR8uZlT0="
      ];
    };

    nixpkgs = {
      config = {
        allowBroken = true;
        allowUnfree = true;
        tarball-ttl = 0;
        contentAddressedByDefault = false;
      };

      overlays = lib.attrValues inputs.self.overlays ++ [
        inputs.ocaml-nvim.overlays.default
      ];
    };

    inherit icons colors color;
  };

  den.aspects.foundation = {
    tests = {
      test-nixpkgs-overlays-exist = {
        expr = builtins.length inputs.self.nixpkgs.overlays > 0;
        expected = true;
      };
      test-colors-edge-exists = {
        expr = inputs.self.colors.lists ? edge;
        expected = true;
      };
      test-color-mkColor-is-function = {
        expr = builtins.isFunction inputs.self.colors.mkColor;
        expected = true;
      };
      test-icons-is-attrset = {
        expr = builtins.isAttrs inputs.self.icons;
        expected = true;
      };
    };
  };
}
