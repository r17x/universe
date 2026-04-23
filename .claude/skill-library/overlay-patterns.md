# Overlay and Package Patterns

## Overlay Structure

Overlays live in `nix/overlays/` and are applied globally.

### Standard overlay
```nix
final: prev: {
  myPackage = final.callPackage ../packages/myPackage { };
}
```

### Extending an existing package set
```nix
final: prev: {
  vimPlugins = prev.vimPlugins // {
    my-plugin = final.vimUtils.buildVimPlugin {
      pname = "my-plugin";
      version = "1.0.0";
      src = inputs.vimPlugins_my-plugin;
    };
  };
}
```

## Custom Package (pkgs-by-name)

### Location
```
nix/packages/<name>/default.nix
```

### Standard package
```nix
{
  lib,
  stdenv,
  fetchFromGitHub,
  ...
}:

stdenv.mkDerivation {
  pname = "<name>";
  version = "1.0.0";

  src = fetchFromGitHub {
    owner = "...";
    repo = "...";
    rev = "...";
    hash = "...";
  };

  nativeBuildInputs = [ ];
  buildInputs = [ ];

  meta = with lib; {
    description = "...";
    license = licenses.mit;
    platforms = platforms.all;
  };
}
```

### Script package
```nix
{ writeShellApplication, ... }:

writeShellApplication {
  name = "<name>";
  runtimeInputs = [ ];
  text = ''
    # script content
  '';
}
```

## Vim Plugin Overlay

Custom vim plugins use flake inputs with `vimPlugins_` prefix:
```nix
# In flake.nix inputs:
vimPlugins_my-plugin = {
  url = "github:author/my-plugin";
  flake = false;
};

# In overlay:
final: prev: {
  vimPlugins = prev.vimPlugins // {
    my-plugin = final.vimUtils.buildVimPlugin {
      pname = "my-plugin";
      version = "latest";
      src = inputs.vimPlugins_my-plugin;
    };
  };
}
```

## macOS App Overlay

For apps distributed as .dmg or .app:
```nix
final: prev: {
  myApp = prev.stdenv.mkDerivation {
    pname = "myApp";
    version = "1.0";
    src = builtins.fetchurl {
      url = "https://...";
      sha256 = "...";
    };
    # macOS-specific installation
  };
}
```
