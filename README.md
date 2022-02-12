# Rin's Home

> Heavily inspired from @malob ([malob/nixpkgs](https://github.com/malob/nixpkgs)).

This is my personal configuration with [nix](https://nixos.org/).

## Basic Usage 

```console
// clone repository (if you're use SSH)
git clone git@github.com:ri7nz/nixpkgs ~/.config/nixpkgs
// OR
git clone https://github.com/ri7nz/nixpkgs ~/.config/nixpkgs

// Change directory

cd ~/.config/nixpkgs

// command: nix build .#darwinConfigurations.[name].system
// Available for [name]:
// * RG 
nix build .#darwinConfigurations.RG.system

// then, will make output at ./result
// command ./result/sw/bin/darwin-rebuild switch --flake .#[name]
// Available for [name]:
// * RG 
./result/sw/bin/darwin-rebuild switch --flake .#RG

// Enjoy 🚀
```


Thanks You
