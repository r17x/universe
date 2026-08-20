import { Command, Flag } from "effect/unstable/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AgentAuditor, formatFixResult, formatReport, type AuditReport } from "./AgentAuditor";
import { SkillAuditor } from "./SkillAuditor";
import { Config } from "./Config";
import { MachineLoader } from "./MachineLoader";
import { Output } from "./protocol.Output";
import { Line, Record } from "./protocol.Emission";

const AllAuditLayers = Layer.provideMerge(
  Layer.merge(AgentAuditor.layer, SkillAuditor.layer),
  Layer.merge(Config.layer, MachineLoader.layer),
);

export const auditAllCommand = Command.make(
  "all",
  {
    fix: Flag.boolean("fix").pipe(Flag.withDefault(false)),
  },
  ({ fix }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const agentAuditor = yield* AgentAuditor;
      const skillAuditor = yield* SkillAuditor;

      if (fix) {
        const [agentResults, skillResults] = yield* Effect.all(
          [agentAuditor.fixAll(), skillAuditor.fixAll()],
          { concurrency: 1 },
        );

        if (agentResults.length > 0) {
          yield* output.emit(Line({ text: "\n--- Agent Fixes ---" }));
        }
        yield* Effect.forEach(agentResults, (result) => formatFixResult(result));

        if (skillResults.length > 0) {
          yield* output.emit(Line({ text: "\n--- Skill Fixes ---" }));
        }
        yield* Effect.forEach(skillResults, (result) => formatFixResult(result));

        const totalFixed = [...agentResults, ...skillResults].reduce(
          (a, r) => a + r.fixes.length,
          0,
        );
        const totalSkipped = [...agentResults, ...skillResults].reduce(
          (a, r) => a + r.skipped.length,
          0,
        );
        yield* output.emit(
          Record({
            fields: [
              ["fixed", String(totalFixed)],
              ["skipped", String(totalSkipped)],
              ["files", String(agentResults.length + skillResults.length)],
            ],
          }),
        );
        return;
      }

      const [agentReports, skillReports] = yield* Effect.all(
        [agentAuditor.auditAll(), skillAuditor.auditAll()],
        { concurrency: "unbounded" },
      );
      const allReports: readonly AuditReport[] = [...agentReports, ...skillReports];

      if (agentReports.length > 0) {
        yield* output.emit(Line({ text: "\n--- Agent Audits ---" }));
      }
      yield* Effect.forEach(agentReports, (report) => formatReport(report));

      if (skillReports.length > 0) {
        yield* output.emit(Line({ text: "\n--- Skill Audits ---" }));
      }
      yield* Effect.forEach(skillReports, (report) => formatReport(report));

      const totalPassed = allReports.reduce((a, r) => a + r.summary.passed, 0);
      const totalWarned = allReports.reduce((a, r) => a + r.summary.warned, 0);
      const totalFailed = allReports.reduce((a, r) => a + r.summary.failed, 0);
      yield* output.emit(
        Record({
          fields: [
            ["passed", String(totalPassed)],
            ["warned", String(totalWarned)],
            ["failed", String(totalFailed)],
            ["files", String(allReports.length)],
          ],
        }),
      );
    }).pipe(Effect.provide(AllAuditLayers)),
);
