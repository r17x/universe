#!/usr/bin/env bash
# Hook: Auto-run nix eval after Nix file changes
# PostToolUse for Edit/Write on .nix files

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty' || true)

# Empty path — allow
[[ -z "$FILE_PATH" ]] && exit 0

# Only check .nix files under nix/ or at flake root
if [[ ! "$FILE_PATH" =~ \.nix$ ]]; then
  exit 0
fi

# Skip files outside the project
if [[ ! "$FILE_PATH" =~ ^"$CLAUDE_PROJECT_DIR" ]]; then
  exit 0
fi

# Run nix eval to validate flake still parses
echo "Validating Nix changes..." >&2
EVAL_OUTPUT=$(cd "$CLAUDE_PROJECT_DIR" && nix flake check --no-build 2>&1) || {
  cat >&2 <<EOF
WARNING: nix flake check failed after editing $FILE_PATH

Output (first 20 lines):
$(echo "$EVAL_OUTPUT" | head -20)

Consider fixing the Nix expression before continuing.
EOF
  # Don't block — just warn. Full check can be slow.
  exit 0
}

echo "nix flake check passed" >&2
exit 0
