#!/usr/bin/env bash
# Hook: Agent-first enforcement — block coordinator from ALL direct edits
# PreToolUse for Edit|Write
# Coordinator must delegate ALL edits to worker agents

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty' || true)

[[ -z "$FILE_PATH" ]] && exit 0

# If we're inside a subagent, allow (worker is doing its job)
if [[ -n "${CLAUDE_AGENT_NAME:-}" ]]; then
  exit 0
fi

# Coordinator is trying to edit a file directly — block ALL edits
# Route to appropriate worker based on file type
if [[ "$FILE_PATH" =~ \.nix$ ]]; then
  AGENT_HINT='nix-coder'
else
  AGENT_HINT='default (general-purpose)'
fi

cat >&2 <<EOF
BLOCKED: Coordinator cannot use Edit/Write directly.

  Target: $FILE_PATH
  Suggested worker: $AGENT_HINT

Delegate ALL file modifications to a worker agent:
  - .nix files → Agent(subagent_type="nix-coder", prompt="...")
  - Other files → Agent(prompt="...")

Tool Restriction Boundary:
  Coordinator: Read, Glob, Grep, Bash (verify only)
  Workers: Edit, Write, Bash
EOF
exit 2
