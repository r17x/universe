---
name: gateway
description: Gateway
updated: "2026-05-10"
---

Routes tasks to domain-specific workers by matching file patterns against the `config.yaml` ground.routing table.

# Gateway

Thin routing gateway. Reads `.anakmagang/config.yaml` ground.routing, matches files to the correct worker agent, and delegates.

## When to use

When the coordinator needs to delegate implementation work to a domain-specific worker agent. This is the default entry point for all file-modifying tasks.

## Steps

1. **Identify affected files** — From the task description, determine which files will be created or modified.

2. **Match to domain** — Look up each file pattern in `.anakmagang/config.yaml` ground.routing:

   | File Pattern | Worker | Specific Gateway |
   |-------------|--------|-----------------|
   | `nix/**/*.nix`, `flake.nix` | `nix-coder` | `skill-library/gateway-nix.md` |
   | `apps/**/*.ts` | `effect-ts` | `skill-library/gateway-effect-ts.md` |
   | `secrets/*.yaml`, `.sops.yaml` | default | — |
   | `*.md`, `*.sh`, `*.lua`, `*.yaml` | default | — |

3. **Delegate to worker** — Spawn the matched worker agent. The worker loads its own specific gateway and skill-library files. Include in the delegation prompt:
   - The task description
   - Which files to modify
   - Any constraints from the coordinator's analysis

4. **Cross-domain tasks** — When files span multiple domains, spawn workers in parallel (one per domain). Each worker handles only its domain files.

5. **Verification** — After worker completes, coordinator runs verification commands.

## Output

Worker completion signal (one of):
```
IMPLEMENTATION_COMPLETE
VERIFICATION_PASSED
VERIFICATION_FAILED
IMPLEMENTATION_BLOCKED
NEEDS_COORDINATOR_INPUT
```

## Constraints

- NEVER delegate markdown, YAML, or shell script files to domain workers — use default agent
- NEVER spawn a worker without specifying which files it should modify
- Workers MUST NOT delegate further (no nested Agent tool calls)
- Cross-domain tasks require parallel workers — never mix domains in one worker
