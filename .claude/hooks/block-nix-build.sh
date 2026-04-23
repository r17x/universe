#!/usr/bin/env bash
# Hook: Block slow nix build commands, prefer nix eval
# PreToolUse for Bash

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' || true)

# Empty command — allow
[[ -z "$COMMAND" ]] && exit 0

# Block darwin-rebuild (suggest universe rebuild instead)
if echo "$COMMAND" | grep -qE '(^|\s)darwin-rebuild\s+switch'; then
  if ! echo "$COMMAND" | grep -q '\-\-dry-run'; then
    cat >&2 <<'EOF'
BLOCKED: darwin-rebuild switch takes a long time. Use verification commands instead:

  nix eval .#darwinConfigurations.<host>.config.<path>  (0.1-0.3s)
  nix flake check --no-build                            (fast validation)

If you truly need to rebuild, use: universe rebuild
EOF
    exit 2
  fi
fi

# Block nix-instantiate (legacy, slow)
if echo "$COMMAND" | grep -qE '(^|\s)nix-instantiate\b'; then
  cat >&2 <<'EOF'
BLOCKED: nix-instantiate is legacy and slow. Use nix eval instead (0.1-0.3s).
EOF
  exit 2
fi

exit 0
