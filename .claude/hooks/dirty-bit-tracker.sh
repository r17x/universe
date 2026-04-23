#!/usr/bin/env bash
# Hook: Dirty bit tracker — record file modifications per phase
# PostToolUse for Edit|Write

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty' || true)

[[ -z "$FILE_PATH" ]] && exit 0

MANIFEST="$CLAUDE_PROJECT_DIR/.data/manifest.yaml"
[[ ! -f "$MANIFEST" ]] && exit 0

CURRENT_PHASE=$(grep 'current_phase:' "$MANIFEST" | tail -1 | sed 's/.*current_phase:\s*//' | sed 's/^none$//' | xargs || true)
[[ -z "$CURRENT_PHASE" ]] && exit 0

DIRTY_DIR="$CLAUDE_PROJECT_DIR/.data/dirty-bits"
mkdir -p "$DIRTY_DIR"
DIRTY_FILE="$DIRTY_DIR/phase-${CURRENT_PHASE}.files"

if ! grep -qxF "$FILE_PATH" "$DIRTY_FILE" 2>/dev/null; then
  echo "$FILE_PATH" >> "$DIRTY_FILE"
  echo "DIRTY BIT: Tracked modification to $FILE_PATH in phase $CURRENT_PHASE" >&2
fi

exit 0
