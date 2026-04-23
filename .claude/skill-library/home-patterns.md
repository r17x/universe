# Home-Manager Module Patterns

## Module Structure

All home modules live in `nix/modules/home/`. Auto-discovered by ez-configs.

### Standard home module
```nix
{
  lib,
  config,
  pkgs,
  colors,
  icons,
  ...
}:

let
  cfg = config.universe.home.<name>;
in
{
  options.universe.home.<name> = {
    enable = lib.mkEnableOption "<description>";
  };

  config = lib.mkIf cfg.enable {
    # home-manager config
  };
}
```

### Configuration files

Home configurations in `nix/configurations/home/`:
- `r17.nix` — Home-manager config for user r17

## Program Modules

### Enable a program
```nix
programs.<name> = {
  enable = true;
  package = pkgs.<name>;
  # program-specific settings
};
```

### Common programs configured
- `git` — Version control with identities
- `fish` — Shell configuration
- `starship` — Prompt
- `tmux` — Terminal multiplexer
- `neovim` — Editor (via nixvim)
- `alacritty` / `kitty` — Terminal emulators
- `direnv` — Environment management

## XDG Config Files

```nix
xdg.configFile = {
  "<app>/config.toml".source = ./config.toml;
  "<app>/settings.json".text = builtins.toJSON {
    key = "value";
  };
};
```

## Shell Configuration

### Fish shell
```nix
programs.fish = {
  enable = true;
  shellInit = ''
    # init commands
  '';
  shellAliases = {
    ll = "ls -la";
  };
  plugins = [
    {
      name = "plugin-name";
      src = pkgs.fishPlugins.plugin-name.src;
    }
  ];
};
```

## Color Theming

The repo uses a shared color scheme defined in `nix/colors.nix`:
```nix
# Access colors in modules via the `colors` argument
{ colors, ... }:
{
  config = {
    programs.alacritty.settings.colors.primary.background = colors.base00;
  };
}
```

## Icons

Shared icon definitions in `nix/icons.nix`:
```nix
{ icons, ... }:
{
  # Use icons in UI configurations
}
```

## Packages

### User-level packages
```nix
home.packages = with pkgs; [
  ripgrep
  fd
  jq
];
```

### Conditional packages
```nix
home.packages = with pkgs; [
  ripgrep
] ++ lib.optionals pkgs.stdenv.isDarwin [
  iterm2
] ++ lib.optionals pkgs.stdenv.isLinux [
  gnome.nautilus
];
```
