# Neovim over Nix

I manage and write Neovim configurations in Nix using Nixvim

## Configuring

To start configuring, just add or modify the nix files in `./config`.
If you add a new configuration file, remember to add it to the
[`config/default.nix`](./config/default.nix) file or example [`config/ui.nix`](./config/ui.nix).

## Testing your new configuration

To test your configuration simply run the following command

```bash
nix run .

# OR

nix run github:r17x/nvim.nix
```
