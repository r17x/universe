#!/usr/bin/env bash
# Hook: Guard agent completion — ensure verification was run
# SubagentStop hook

set -euo pipefail

INPUT=$(cat)

# Extract agent output
AGENT_OUTPUT=$(echo "$INPUT" | jq -r '.output // .transcript // .result // empty' || true)

# If no output available, allow (can't verify)
[[ -z "$AGENT_OUTPUT" ]] && exit 0

# Check if agent ran Nix verification commands
HAS_NIX_EVAL=$(echo "$AGENT_OUTPUT" | grep -c 'nix eval\|nix flake check\|nix flake show' || true)
HAS_NIX_FMT=$(echo "$AGENT_OUTPUT" | grep -c 'nix fmt\|nixfmt' || true)

# At least one verification should have been run for Nix changes
HAS_NIX_FILE=$(echo "$AGENT_OUTPUT" | grep -c '\.nix' || true)

if [[ "$HAS_NIX_FILE" -gt 0 ]] && [[ "$HAS_NIX_EVAL" -eq 0 ]] && [[ "$HAS_NIX_FMT" -eq 0 ]]; then
  cat >&2 <<'EOF'
BLOCKED: Agent modified .nix files but did not run verification.

Run one of:
  nix eval .#darwinConfigurations.<host>.config --apply builtins.attrNames  (fast)
  nix flake check --no-build                                                 (full)
  nix fmt                                                                    (formatting)

Agents should verify Nix changes before completing.
EOF
  exit 2
fi

exit 0
