---
name: nix-debug
description: Deep debugging of Nix expressions, evaluation, and derivations
allowed-tools:
  - Bash
  - Read
---

# Nix Deep Debugging

## nix eval - Complete Reference

```bash
# Basic
nix eval .#attr                     # Evaluate attribute
nix eval .#attr --json              # JSON output
nix eval .#attr --raw               # Raw string output

# Apply transformation
nix eval .#attr --apply 'x: x.meta'
nix eval .#attr --apply 'builtins.attrNames'

# Arbitrary expressions
nix eval --expr '1 + 1'
nix eval --expr 'builtins.attrNames (import ./. {})'
nix eval --expr --impure 'builtins.getEnv "HOME"'

# Remote flakes
nix eval nixpkgs#hello.meta
nix eval github:NixOS/nixpkgs#lib.version

# Debug flags
nix eval .#attr --show-trace        # Full stack trace
nix eval .#attr --debugger          # Interactive debugger
nix eval .#attr -vvvvv              # Maximum verbosity
```

## nix repl - Interactive Debugging

```bash
# Start with flake
nix repl --expr 'builtins.getFlake (toString ./.)'
nix repl .#                         # Nix 2.19+

# Start with nixpkgs
nix repl '<nixpkgs>'
nix repl --expr 'import <nixpkgs> {}'
```

### REPL Commands
```
:?                  Help
:p EXPR             Pretty print (shows structure)
:t EXPR             Show type
:b DRV              Build derivation
:l PATH             Load nix file
:lf FLAKE           Load flake
:r                  Reload all files
:q                  Quit
:doc FUNC           Show documentation (Nix 2.10+)
```

### REPL Introspection Patterns
```nix
# List all attributes
builtins.attrNames someSet

# Recursive attribute listing
lib.attrsets.mapAttrsRecursive (path: value: path) someSet

# Check what's in a module
builtins.attrNames config.services

# Find where option is defined
options.services.nginx.enable.definitionsWithLocations

# Function signature
builtins.functionArgs someFunction
# Returns: { arg1 = false; arg2 = true; }
# true = has default value

# Get source location
builtins.unsafeGetAttrPos "enable" options.services.nginx
# Returns: { file = "/path"; line = 42; column = 5; }
```

## Built-in Debug Functions

### builtins.trace
```nix
# Print message, return value unchanged
builtins.trace "checkpoint reached" someValue

# Print with value
builtins.trace "value is: ${toString x}" x

# Conditional trace
builtins.trace (if debug then "debug: ${msg}" else "") value
```

### lib.debug Functions
```nix
# Print and return value
lib.debug.traceVal expr
# Prints: trace: <value>
# Returns: <value>

# Deep evaluate then print
lib.debug.traceValSeq expr

# Print first, return second
lib.debug.traceSeq exprToPrint exprToReturn

# Trace with label
lib.debug.traceValFn (x: "myVar = ${toString x}") myVar

# Trace attribute set keys
lib.debug.traceSeqN 2 someSet result  # depth 2
```

### Debugging Assertions
```nix
# Show what failed
assert lib.assertMsg (x > 0) "x must be positive, got: ${toString x}";
result

# Warn without failing
lib.warn "deprecated option used" value
lib.warnIf condition "message" value
```

## Interactive Debugger (Nix 2.9+)

```bash
nix eval .#attr --debugger
```

### Debugger Commands
```
:bt               Show backtrace
:env              Show current environment
:st               Step into
:s                Step over
:c                Continue
:q                Quit debugger
```

### Trigger Debugger Programmatically
```nix
builtins.break value  # Breaks here when --debugger is used
```

## nix-instantiate - Deep Evaluation

```bash
# Strict evaluation (force everything)
nix-instantiate --eval --strict -E 'import ./.'

# Parse only (syntax check)
nix-instantiate --parse ./file.nix

# Show what would be built
nix-instantiate ./default.nix

# Evaluate specific attribute
nix-instantiate --eval -A attrPath ./file.nix
```

## Derivation Debugging

```bash
# Show derivation structure
nix derivation show .#package

# Show build log
nix log .#package
nix log /nix/store/<hash>-name

# Why does A depend on B?
nix why-depends .#package .#dependency

# Path info
nix path-info -rsSh .#package    # recursive, size, human
nix path-info --json .#package | jq
```

## Error Diagnosis Cookbook

### "infinite recursion encountered"
```bash
# 1. Get trace
nix eval .#attr --show-trace 2>&1 | tail -100

# 2. Look for repeated file/line
# 3. Check for:
#    - Module importing itself
#    - config.x referencing config.x
#    - Overlays referencing final before defined
```

### "attribute 'x' missing"
```bash
# List available attributes
nix eval .#someSet --apply builtins.attrNames

# In REPL
:p builtins.attrNames someSet

# Check if it exists
nix eval --expr 'someSet ? x'
```

### "called with unexpected argument 'x'"
```bash
# Check expected arguments
nix eval --expr 'builtins.functionArgs someFn'

# Shows: { expectedArg1 = false; expectedArg2 = true; }
```

### "cannot coerce X to string"
```nix
# Problem: ${nonString}
# Solutions:
toString value           # for numbers, paths
builtins.toJSON value    # for complex values
lib.generators.toPretty {} value  # pretty print
```

### "is not a function"
```bash
# Check type
nix eval --expr 'builtins.typeOf problemValue'

# Common cause: forgot to import
# Wrong: pkgs.callPackage ./pkg.nix
# Right: pkgs.callPackage ./pkg.nix {}
```

## Module System Debugging

```bash
# See final option value
nix eval .#nixosConfigurations.host.config.services.nginx.enable

# See option definition locations
nix eval .#nixosConfigurations.host.options.services.nginx.enable.files

# See all definitions
nix eval .#nixosConfigurations.host.options.services.nginx.enable.definitionsWithLocations --json | jq

# Check if option exists
nix eval --expr '.#nixosConfigurations.host.options.services ? nginx'
```

## Performance Debugging

```bash
# Time evaluation
time nix eval .#attr --json >/dev/null 2>&1

# Verbose timing
NIX_SHOW_STATS=1 nix eval .#attr

# Find slow imports (add traces)
nix eval --expr '
  builtins.trace "before import" (
    let x = import ./.;
    in builtins.trace "after import" x
  )
'
```

## Quick Debug Snippets

```nix
# Print current file/line
builtins.trace "at ${__curPos.file}:${toString __curPos.line}" value

# Dump entire set structure
builtins.trace (builtins.toJSON (builtins.mapAttrs (k: v: builtins.typeOf v) someSet)) result

# Assert with helpful message
assert builtins.isAttrs x || throw "Expected set, got ${builtins.typeOf x}";
```
