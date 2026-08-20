import { Array as Arr, Context, Effect, Layer, Schema } from "effect";
import type { DomainRoute } from "./Machine";
import { MachineLoader } from "./MachineLoader";
import { Config } from "./Config";
import { makeAuditor, resultOf } from "./AuditShared";
import { allChecks } from "./checks.agent";
import { Output } from "./protocol.Output";
import { Line, Record } from "./protocol.Emission";

export const AuditResultSchema = Schema.Struct({
  phase: Schema.Number,
  check: Schema.String,
  status: Schema.Literals(["pass", "warn", "fail"]),
  message: Schema.String,
});
export type AuditResult = typeof AuditResultSchema.Type;

export const AuditReportSchema = Schema.Struct({
  target: Schema.String,
  type: Schema.Literals(["agent", "skill"]),
  results: Schema.Array(AuditResultSchema),
  summary: Schema.Struct({
    passed: Schema.Number,
    warned: Schema.Number,
    failed: Schema.Number,
  }),
});
export type AuditReport = typeof AuditReportSchema.Type;
export const AuditReportsSchema = Schema.Array(AuditReportSchema);

export const FixResultSchema = Schema.Struct({
  target: Schema.String,
  fixes: Schema.Array(Schema.String),
  skipped: Schema.Array(Schema.String),
});
export type FixResult = typeof FixResultSchema.Type;

export class AuditError extends Schema.TaggedErrorClass<AuditError>()("AuditError", {
  target: Schema.String,
  message: Schema.String,
}) {}

export const makeSummary = (results: readonly AuditResult[]) => ({
  passed: Arr.filter(results, (r) => r.status === "pass").length,
  warned: Arr.filter(results, (r) => r.status === "warn").length,
  failed: Arr.filter(results, (r) => r.status === "fail").length,
});

export const formatReport = (report: AuditReport): Effect.Effect<void, never, Output> =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(Record({ fields: [["target", report.target]] }));
    yield* Effect.forEach(report.results, (r) => {
      const icon = r.status === "pass" ? "OK" : r.status === "warn" ? "WARN" : "FAIL";
      return output.emit(
        Record({
          fields: [
            ["status", `[${icon}]`],
            ["phase", String(r.phase)],
            ["check", r.check],
            ["message", r.message],
          ],
        }),
      );
    });
    yield* output.emit(
      Record({
        fields: [
          ["passed", String(report.summary.passed)],
          ["warned", String(report.summary.warned)],
          ["failed", String(report.summary.failed)],
        ],
      }),
    );
  });

export const formatFixResult = (result: FixResult): Effect.Effect<void, never, Output> =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(Line({ text: `\n=== ${result.target} ===` }));
    if (result.fixes.length === 0) {
      yield* output.emit(Line({ text: "  No fixes needed" }));
    } else {
      yield* Effect.forEach(result.fixes, (f) => output.emit(Line({ text: `  [FIXED] ${f}` })));
    }
    if (result.skipped.length > 0) {
      yield* Effect.forEach(result.skipped, (s) => output.emit(Line({ text: `  [SKIP] ${s}` })));
    }
  });

export interface AgentAuditorContract {
  readonly audit: (filePath: string) => Effect.Effect<AuditReport, AuditError>;
  readonly auditAll: () => Effect.Effect<readonly AuditReport[], AuditError>;
  readonly fix: (filePath: string) => Effect.Effect<FixResult, AuditError>;
  readonly fixAll: () => Effect.Effect<readonly FixResult[], AuditError>;
}

export class AgentAuditor extends Context.Service<AgentAuditor, AgentAuditorContract>()(
  "@anakmagang/AgentAuditor",
) {
  static readonly layer = Layer.effect(
    AgentAuditor,
    Effect.gen(function* () {
      const config = yield* Config;
      const loader = yield* MachineLoader;
      const machine = yield* loader
        .loadFromFile(config.configPath)
        .pipe(Effect.orElseSucceed(() => undefined));
      const routes: readonly DomainRoute[] = machine?.ground?.routing ?? [];
      return yield* makeAuditor({
        type: "agent",
        dirSegments: [".claude", "agents"],
        frontmatterCheckName: "frontmatter",
        checks: allChecks(routes, config.promises),
        validateFrontmatter: (parsed) =>
          !parsed || !parsed.fm["name"] || !parsed.fm["description"]
            ? resultOf(
                1,
                "frontmatter",
                "fail",
                "Missing or invalid frontmatter (need name, description)",
              )
            : resultOf(1, "frontmatter", "pass", "Valid frontmatter"),
      });
    }),
  );
}
