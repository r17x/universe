#!/usr/bin/env bash
# Hook: Inject context reminders and meta-cognitive prompts (UserPromptSubmit)
# Always exits 0 — informational only, never blocks
#
# Reads sessions-based manifest schema:
#   sessions[].current_task  — "none" or task description
#   sessions[].current_phase — "none" or phase number

set -euo pipefail

# shellcheck disable=SC2034
INPUT=$(cat)

MANIFEST="$CLAUDE_PROJECT_DIR/.data/manifest.yaml"

if [[ -f "$MANIFEST" ]]; then
  # Extract last session's current_task (flat string, not nested description)
  TASK_DESC=$(grep 'current_task:' "$MANIFEST" | tail -1 | sed 's/.*current_task:\s*//' | sed 's/^"//;s/"$//' | sed 's/^none$//' || true)

  if [[ -n "$TASK_DESC" ]]; then
    CURRENT_PHASE=$(grep 'current_phase:' "$MANIFEST" | tail -1 | sed 's/.*current_phase:\s*//' | sed 's/^none$//' | xargs || true)
    COMPLETED=$(grep 'completed_phases:' "$MANIFEST" | tail -1 | sed 's/.*completed_phases:\s*//' | xargs || true)

    echo "Active task: $TASK_DESC"
    [[ -n "$CURRENT_PHASE" ]] && echo "Phase: ${CURRENT_PHASE} | Done: ${COMPLETED:-none}"

    # Meta-cognitive question by phase
    if [[ -n "$CURRENT_PHASE" ]]; then
      PHASE_NUM=$(echo "$CURRENT_PHASE" | tr -dc '0-9')
      if [[ -n "$PHASE_NUM" ]]; then
        case "$PHASE_NUM" in
          1) echo "REFLECT: What assumptions am I carrying from past context?" ;;
          2) echo "REFLECT: Am I solving the right problem? Is my size classification honest?" ;;
          3) echo "REFLECT: Am I anchoring on the first thing I found, or searching broadly?" ;;
          4) echo "REFLECT: Do I have the right skills loaded for this problem?" ;;
          5) echo "REFLECT: What am I underestimating? What unknown could derail this?" ;;
          6) echo "REFLECT: Are these genuinely different approaches, or variations of the same idea?" ;;
          7) echo "REFLECT: Will this design survive edge cases? Am I overengineering?" ;;
          8) echo "REFLECT: Did I delegate with enough context? Could the worker misinterpret?" ;;
          9) echo "REFLECT: Did the implementation drift from the design? Why?" ;;
          10) echo "REFLECT: Am I checking rules mechanically, or understanding their intent?" ;;
          11) echo "REFLECT: Would I be confident rebuilding the system right now?" ;;
          12) echo "REFLECT: Am I testing what matters, or what's easy to test?" ;;
          13) echo "REFLECT: Do these checks prove correctness, or just exercise code paths?" ;;
          14) echo "REFLECT: What failure mode isn't covered?" ;;
          15) echo "REFLECT: Could these checks pass with subtly broken code?" ;;
          16) echo "REFLECT: What would I do differently if I started over?" ;;
        esac

        if [[ "$PHASE_NUM" -eq 8 ]]; then
          echo "REMINDER: After implementation, continue to verification phases 9-16."
        fi
      fi
    fi
  fi
fi

# Gateway protocol reminder
echo "Route Nix work via /gateway-nix. Use /orchestrate for non-trivial tasks."

exit 0
