#!/usr/bin/env bash
# Hook: Guard session end — ensure no active task is abandoned
# Stop hook
#
# Sessions-based manifest schema:
#   sessions[].current_task  — "none" or task description
#   sessions[].current_phase — "none" or phase number

set -euo pipefail

# shellcheck disable=SC2034
INPUT=$(cat)

MANIFEST="$CLAUDE_PROJECT_DIR/.data/manifest.yaml"

# No manifest — allow
[[ ! -f "$MANIFEST" ]] && exit 0

# Check if the last session has an active task (not "none")
TASK_DESC=$(grep 'current_task:' "$MANIFEST" | tail -1 | sed 's/.*current_task:\s*//' | sed 's/^"//;s/"$//' | sed 's/^none$//' || true)

# No active task — allow
[[ -z "$TASK_DESC" ]] && exit 0

# Check if there's an incomplete phase (not "none" and not phase 16)
CURRENT_PHASE=$(grep 'current_phase:' "$MANIFEST" | tail -1 | sed 's/.*current_phase:\s*//' | sed 's/^none$//' | xargs || true)

# No active phase or completed (phase 16) — allow
[[ -z "$CURRENT_PHASE" ]] && exit 0
[[ "$CURRENT_PHASE" == "16" ]] && exit 0

cat >&2 <<EOF
BLOCKED: Active task at phase $CURRENT_PHASE. Complete or clear the task before ending.

Active task: $TASK_DESC
Current phase: $CURRENT_PHASE

Either:
  1. Complete the remaining phases
  2. Set current_task to "none" in .data/manifest.yaml to clear it
EOF
exit 2
