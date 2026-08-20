import { Array as Arr, Effect } from "effect";
import type { AuditResult } from "./AgentAuditor";
import type { MarkdownDocument } from "./Markdown";
import { resultOf } from "./AuditShared";

export interface CheckContext {
  readonly body: string;
  readonly lowerBody: string;
  readonly doc: MarkdownDocument;
  readonly fm: Record<string, unknown>;
  readonly content: string;
  readonly filePath: string;
  readonly lines: readonly string[];
}

export interface AuditCheck {
  readonly phase: number;
  readonly name: string;
  readonly run: (ctx: CheckContext) => Effect.Effect<AuditResult>;
}

export const pureCheck = (
  phase: number,
  name: string,
  fn: (ctx: CheckContext) => AuditResult,
): AuditCheck => ({
  phase,
  name,
  run: (ctx) => Effect.succeed(fn(ctx)),
});

export const runChecks = (
  checks: readonly AuditCheck[],
  ctx: CheckContext,
): Effect.Effect<readonly AuditResult[]> => Effect.forEach(checks, (c) => c.run(ctx));

export const skipAll = (checks: readonly AuditCheck[]): readonly AuditResult[] =>
  Arr.map(checks, (c) =>
    resultOf(c.phase, "skipped", "fail", "Skipped: frontmatter validation failed"),
  );
