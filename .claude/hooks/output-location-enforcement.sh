#!/usr/bin/env bash
# Hook: Output location enforcement — validate write paths are within project bounds
# PreToolUse for Edit|Write

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty' || true)

[[ -z "$FILE_PATH" ]] && exit 0

ABS_PATH=$(cd "$CLAUDE_PROJECT_DIR" && realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

if [[ ! "$ABS_PATH" =~ ^"$CLAUDE_PROJECT_DIR" ]]; then
  cat >&2 <<EOF
BLOCKED: Write target is outside project directory.

  Target: $FILE_PATH
  Project: $CLAUDE_PROJECT_DIR

All file modifications must be within the project directory.
EOF
  exit 2
fi

BLOCKED_PATTERNS=(
  "secrets/secret.yaml"
  ".sops.yaml"
  ".git/"
  "result/"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if [[ "$ABS_PATH" =~ $pattern ]]; then
    cat >&2 <<EOF
BLOCKED: Write to restricted path.

  Target: $FILE_PATH
  Pattern: $pattern

This location is restricted. Use appropriate tools (sops for secrets, git CLI for git operations).
EOF
    exit 2
  fi
done

exit 0
