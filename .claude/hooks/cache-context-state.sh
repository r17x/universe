#!/usr/bin/env bash
# Status line script: caches real context window data for hooks to read
# Receives full session JSON from Claude Code via stdin
# Cache is scoped per session_id to avoid cross-session contamination

set -euo pipefail

INPUT=$(cat)

# Extract session_id and used_percentage
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id" *: *"[^"]*"' | head -1 | sed 's/"session_id" *: *"//;s/"$//' || true)
PCT=$(echo "$INPUT" | grep -o '"used_percentage" *: *[0-9]*' | head -1 | sed 's/"used_percentage" *: *//' || true)

# If we got valid data, cache it (atomic write via temp file + mv)
if [[ -n "${SESSION_ID:-}" && -n "${PCT:-}" && "$PCT" =~ ^[0-9]+$ ]]; then
  CACHE_DIR="${CLAUDE_PROJECT_DIR:-.}/.data/context-cache"
  CACHE_FILE="$CACHE_DIR/${SESSION_ID}.json"
  mkdir -p "$CACHE_DIR"
  TMP_FILE=$(mktemp "$CACHE_DIR/.tmp.XXXXXX")
  printf '{"used_percentage":%d,"timestamp":%d,"session_id":"%s"}\n' "$PCT" "$(date +%s)" "$SESSION_ID" > "$TMP_FILE"
  mv -f "$TMP_FILE" "$CACHE_FILE"
fi

# Output status line (displayed in Claude Code UI)
if [[ -n "${PCT:-}" ]]; then
  echo "ctx: ${PCT}%"
fi
