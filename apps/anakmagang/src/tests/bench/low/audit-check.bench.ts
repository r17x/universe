import { Effect } from "effect";
import { describe, test } from "bun:test";
import type { CheckContext } from "../../../AuditCheck";
import { pureCheck, skipAll } from "../../../AuditCheck";
import { collectSkipped, extractDescription, resultOf } from "../../../AuditShared";
import { allChecks as agentAllChecks } from "../../../checks.agent";
import { allChecks as skillAllChecks } from "../../../checks.skill";
import type { AuditReport } from "../../../AgentAuditor";
import * as Markdown from "../../../Markdown";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const agentMarkdown = `---
name: effect-ts
description: Effect-TS worker agent for TypeScript tasks
updated: 2026-05-10
---

# Effect-TS Worker Agent

You are the **Effect-TS worker agent** for the R17{x} Universe configuration.

## Role

- Receive TypeScript tasks from the coordinator
- Write Effect-TS services, commands, errors, and layers
- Run verification before completing

## Tool Permissions

- **USE**: Edit, Write, Bash, Read, Glob, Grep
- **DO NOT USE**: Agent (cannot delegate to other agents)

## Verification

\`\`\`bash
nix develop .#anakmagang --command bun run typecheck
nix develop .#anakmagang --command bun test
\`\`\`

## Completion Promises

- IMPLEMENTATION_COMPLETE
- VERIFICATION_PASSED
- VERIFICATION_FAILED
- IMPLEMENTATION_BLOCKED
- NEEDS_COORDINATOR_INPUT

## Output Format

Report results in structured format with file paths and verification status.
`;

const skillMarkdown = `---
name: orchestrate
description: 16-Phase Orchestration Protocol for task management
updated: 2026-05-10
---

# Orchestration Protocol

This skill provides a structured 16-phase workflow for managing tasks.

## When to use

- Starting any new task
- Resuming an interrupted session

## Steps

1. Run \`anakmagang state\` to check current state
2. Classify the task size
3. Begin phase tracking

\`\`\`bash
anakmagang start "my task"
anakmagang eval "reflection" --session <id>
\`\`\`

## Constraints

- You must not skip phases without justification
- Never auto-apply patches to CLAUDE.md
- Do not advance with low confidence

## Output

Return the session ID and current phase status.
`;

const makeCtx = (markdown: string, filePath: string): CheckContext => {
  const parsed = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  const fmRaw = parsed ? parsed[1] : "";
  const body = parsed ? parsed[2] : markdown;
  const fm: Record<string, unknown> = {};
  for (const line of fmRaw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      fm[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  return {
    body,
    lowerBody: body.toLowerCase(),
    doc: Markdown.parse(body),
    fm,
    content: markdown,
    filePath,
    lines: markdown.split("\n"),
  };
};

const agentCtx = makeCtx(agentMarkdown, ".claude/agents/effect-ts.md");
const skillCtx = makeCtx(skillMarkdown, ".claude/skills/orchestrate/SKILL.md");

const sampleReport: AuditReport = {
  target: "test.md",
  type: "agent",
  results: [
    resultOf(1, "frontmatter", "pass", "Valid frontmatter"),
    resultOf(2, "tool-boundary", "pass", "Tool permissions defined"),
    resultOf(3, "delegation", "warn", "No explicit Agent tool mention"),
    resultOf(4, "verification", "fail", "No verification commands found"),
  ],
  summary: { passed: 2, warned: 1, failed: 1 },
};

const emptyRoutes: readonly [] = [];
const defaultPromises = [
  "IMPLEMENTATION_COMPLETE",
  "VERIFICATION_PASSED",
  "VERIFICATION_FAILED",
  "IMPLEMENTATION_BLOCKED",
  "NEEDS_COORDINATOR_INPUT",
  "REVIEW_PASSED",
  "REVIEW_ISSUES_FOUND",
  "REVIEW_BLOCKED",
] as const;
const agentChecks = agentAllChecks(emptyRoutes, defaultPromises);
const skillChecks = skillAllChecks(
  { exists: () => Effect.succeed(true) } as never,
  { resolve: (...args: readonly string[]) => args.join("/") } as never,
);

describe("AuditShared", () => {
  test("resultOf", () => {
    measure("resultOf", () => {
      resultOf(1, "test-check", "pass", "Everything is fine");
    });
  });

  test("extractDescription", () => {
    measure("extractDescription", () => {
      extractDescription(agentMarkdown);
    });
  });

  test("collectSkipped", () => {
    measure("collectSkipped", () => {
      collectSkipped(sampleReport, "frontmatter");
    });
  });
});

describe("AuditCheck", () => {
  test("pureCheck creation", () => {
    measure("pureCheck creation", () => {
      pureCheck(1, "bench-check", () => resultOf(1, "bench-check", "pass", "ok"));
    });
  });

  test("skipAll", () => {
    measure("skipAll", () => {
      skipAll(agentChecks);
    });
  });
});

describe("Agent Checks", () => {
  for (const check of agentChecks) {
    test(check.name, () => {
      measure(check.name, () => {
        Effect.runSync(check.run(agentCtx));
      });
    });
  }
});

describe("Skill Checks", () => {
  const selectedNames = [
    "has-name",
    "has-description",
    "size-check",
    "purpose-statement",
    "actionable-content",
    "no-placeholder",
    "naming-convention",
    "no-secrets",
  ] as const;

  const selectedChecks = skillChecks.filter((c: { readonly name: string }) =>
    (selectedNames as readonly string[]).includes(c.name),
  );

  for (const check of selectedChecks) {
    test(check.name, () => {
      measure(check.name, () => {
        Effect.runSync(check.run(skillCtx));
      });
    });
  }
});
