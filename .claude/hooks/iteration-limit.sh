#!/usr/bin/env bash
# Hook: Iteration limit — cap tool calls per task to prevent infinite loops
# PreToolUse (general matcher)

set -euo pipefail

# shellcheck disable=SC2034
INPUT=$(cat)

MANIFEST="$CLAUDE_PROJECT_DIR/.data/manifest.yaml"

[[ ! -f "$MANIFEST" ]] && exit 0

TASK_DESC=$(grep 'current_task:' "$MANIFEST" | tail -1 | sed 's/.*current_task:\s*//' | sed 's/^"//;s/"$//' | sed 's/^none$//' || true)

[[ -z "$TASK_DESC" ]] && exit 0

COUNTER_DIR="$CLAUDE_PROJECT_DIR/.data/iteration-counts"
mkdir -p "$COUNTER_DIR"

TASK_HASH=$(echo "$TASK_DESC" | md5sum 2>/dev/null | cut -c1-12 || echo "$TASK_DESC" | md5 2>/dev/null | cut -c1-12 || echo "default")
COUNTER_FILE="$COUNTER_DIR/${TASK_HASH}.count"

COUNT=0
[[ -f "$COUNTER_FILE" ]] && COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
COUNT=$(( COUNT + 1 ))
echo "$COUNT" > "$COUNTER_FILE"

MAX_ITERATIONS=50
WARN_THRESHOLD=40

if [[ "$COUNT" -gt "$MAX_ITERATIONS" ]]; then
  cat >&2 <<EOF
BLOCKED: Iteration limit reached ($COUNT/$MAX_ITERATIONS tool calls for this task).

This task has exceeded the maximum number of tool calls. This likely indicates:
  - An infinite retry loop
  - A task that needs to be broken into smaller pieces
  - A blocker requiring user input

Escalate to the user with AskUserQuestion.
To reset: rm $COUNTER_FILE
EOF
  exit 2
fi

if [[ "$COUNT" -gt "$WARN_THRESHOLD" ]]; then
  echo "WARNING: Approaching iteration limit ($COUNT/$MAX_ITERATIONS). Consider wrapping up or escalating." >&2
fi

exit 0
