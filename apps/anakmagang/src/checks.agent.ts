import * as Effect from "effect/Effect";
import type { DomainRoute } from "./Machine";
import type { AuditCheck } from "./AuditCheck";
import { pureCheck } from "./AuditCheck";
import { resultOf } from "./AuditShared";
import * as Markdown from "./Markdown";

const toolBoundary: AuditCheck = pureCheck(2, "tool-boundary", (ctx) => {
  const hasToolSection =
    ctx.body.includes("USE") &&
    (ctx.body.includes("DO NOT USE") || ctx.body.includes("DO NOT use"));
  return resultOf(
    2,
    "tool-boundary",
    hasToolSection ? "pass" : "warn",
    hasToolSection ? "Tool permissions defined" : "No tool boundary section found",
  );
});

const delegation: AuditCheck = pureCheck(3, "delegation", (ctx) => {
  const mentionsAgent = ctx.lowerBody.includes("agent") && ctx.lowerBody.includes("tool");
  const forbidsAgent = ctx.lowerBody.includes("do not") && ctx.lowerBody.includes("agent");
  return mentionsAgent && forbidsAgent
    ? resultOf(3, "delegation", "pass", "Correctly forbids Agent tool")
    : mentionsAgent && !forbidsAgent
      ? resultOf(3, "delegation", "fail", "Mentions Agent tool without forbidding it")
      : resultOf(3, "delegation", "warn", "No explicit Agent tool mention");
});

const verification: AuditCheck = pureCheck(4, "verification", (ctx) => {
  const hasVerification =
    Markdown.containsKeyword(ctx.body, ["verif"]) && ctx.doc.codeBlocks.length > 0;
  return resultOf(
    4,
    "verification",
    hasVerification ? "pass" : "warn",
    hasVerification ? "Verification section found" : "No verification commands found",
  );
});

const makeCompletionPromises = (promises: readonly string[]): AuditCheck =>
  pureCheck(5, "completion-promises", (ctx) => {
    const hasPromises = promises.some((s) => ctx.body.includes(s));
    return resultOf(
      5,
      "completion-promises",
      hasPromises ? "pass" : "warn",
      hasPromises ? "Completion promises defined" : "No completion promise strings found",
    );
  });

const skillRefs: AuditCheck = pureCheck(6, "skill-refs", (ctx) => {
  const hasSkillRefs = ctx.body.includes(".claude/skills/") || ctx.body.includes("skill");
  return resultOf(
    6,
    "skill-refs",
    "pass",
    hasSkillRefs ? "Skill references found" : "No skill references (informational)",
  );
});

const size: AuditCheck = pureCheck(7, "size", (ctx) => {
  const lineCount = ctx.content.split("\n").length;
  return resultOf(7, "size", lineCount <= 150 ? "pass" : "warn", `${lineCount} lines (limit: 150)`);
});

const makeArchAlignment = (routes: readonly DomainRoute[]): AuditCheck => ({
  phase: 8,
  name: "arch-alignment",
  run: (ctx) => {
    const name = String(ctx.fm["name"]);
    const inRouting = routes.some((r) => r.worker === name);
    return Effect.succeed(
      resultOf(
        8,
        "arch-alignment",
        inRouting ? "pass" : "warn",
        inRouting
          ? `Found in routing config as "${name}"`
          : `"${name}" not found in domain routing`,
      ),
    );
  },
});

const outputFormat: AuditCheck = pureCheck(9, "output-format", (ctx) => {
  const hasOutput =
    Markdown.containsKeyword(ctx.body, ["output", "result", "format"]) &&
    ctx.doc.codeBlocks.length > 0;
  return resultOf(
    9,
    "output-format",
    hasOutput ? "pass" : "warn",
    hasOutput ? "Output format defined" : "No structured output format found",
  );
});

export const allChecks = (
  routes: readonly DomainRoute[],
  promises: readonly string[],
): readonly AuditCheck[] => [
  toolBoundary,
  delegation,
  verification,
  makeCompletionPromises(promises),
  skillRefs,
  size,
  makeArchAlignment(routes),
  outputFormat,
];
