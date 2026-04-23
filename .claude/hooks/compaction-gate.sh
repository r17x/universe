#!/usr/bin/env bash
# Hook: Context budget enforcement before agent spawning
# PreToolUse for Agent tool
# Cache is scoped per session_id to avoid cross-session contamination

set -euo pipefail

INPUT=$(cat)

# Extract session_id from hook input
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id" *: *"[^"]*"' | head -1 | sed 's/"session_id" *: *"//;s/"$//' || true)

CONTEXT_USAGE=""

# Primary: read session-scoped cached context state
if [[ -n "${SESSION_ID:-}" ]]; then
  CACHE_FILE="${CLAUDE_PROJECT_DIR:-.}/.data/context-cache/${SESSION_ID}.json"
  if [[ -f "$CACHE_FILE" ]]; then
    # Only trust cache if less than 120 seconds old
    CACHE_TS=$(grep -o '"timestamp" *: *[0-9]*' "$CACHE_FILE" | sed 's/"timestamp" *: *//' || true)
    NOW=$(date +%s)
    if [[ -n "$CACHE_TS" && $(( NOW - CACHE_TS )) -lt 120 ]]; then
      CONTEXT_USAGE=$(grep -o '"used_percentage" *: *[0-9]*' "$CACHE_FILE" | sed 's/"used_percentage" *: *//' || true)
    fi
  fi
fi

# Fallback: estimate from transcript file size
if [[ -z "$CONTEXT_USAGE" ]]; then
  TRANSCRIPT_PATH=$(echo "$INPUT" | grep -o '"transcript_path" *: *"[^"]*"' | sed 's/"transcript_path" *: *"//;s/"$//' || true)
  if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
    FILE_SIZE=$(wc -c < "$TRANSCRIPT_PATH" | tr -d ' ')
    # ~7 bytes per token in JSONL, 200K token window
    CONTEXT_USAGE=$(( FILE_SIZE * 100 / 1400000 ))
    [[ "$CONTEXT_USAGE" -gt 100 ]] && CONTEXT_USAGE=100
  fi
fi

# No data — allow
[[ -z "$CONTEXT_USAGE" ]] && exit 0

if [[ "$CONTEXT_USAGE" -gt 85 ]]; then
  cat >&2 <<EOF
BLOCKED: Context at ${CONTEXT_USAGE}% usage. Must write handoff notes before compacting.

Write handoff notes to .data/manifest.yaml before compacting:

  ## Required Handoff Format
  1. Update manifest session_context with:
     - current_phase: <phase number>
     - dirty_files: <list of files modified this session>
     - active_tasks: <list of delegated tasks still running>
     - blockers: <anything preventing progress>
  2. Write key findings to session_context.handoff_notes:
     - What was accomplished
     - What remains to be done
     - Critical context that would be lost on compaction
  3. Save any reusable learnings to .claude/memories/

Then spawn the agent in a new context.
EOF
  exit 2
fi

if [[ "$CONTEXT_USAGE" -gt 75 ]]; then
  echo "WARNING: Context at ${CONTEXT_USAGE}% usage. Consider compacting before spawning agents." >&2
fi

exit 0
