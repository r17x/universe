import { Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Layer, Schema } from "effect"
import { AgentAuditor, AuditReportsSchema, formatReport, type AuditReport } from "./AgentAuditor"
import { SkillAuditor } from "./SkillAuditor"
import { ArchParser } from "./ArchParser"

const AllAuditLayers = Layer.provideMerge(
  Layer.merge(AgentAuditor.layer, SkillAuditor.layer),
  ArchParser.layer
)

export const auditAllCommand = Command.make(
  "all",
  {
    format: Flag.choice("format", ["human", "json"] as const).pipe(Flag.withAlias("f"), Flag.withDefault("human" as const)),
  },
  ({ format }) =>
    Effect.gen(function* () {
      const agentAuditor = yield* AgentAuditor
      const skillAuditor = yield* SkillAuditor
      const [agentReports, skillReports] = yield* Effect.all(
        [agentAuditor.auditAll(), skillAuditor.auditAll()],
        { concurrency: "unbounded" },
      )
      const allReports: readonly AuditReport[] = [...agentReports, ...skillReports]

      if (format === "json") {
        const json = yield* Schema.encodeEffect(Schema.fromJsonString(AuditReportsSchema))(allReports)
        yield* Console.log(json)
        return
      }

      if (agentReports.length > 0) {
        yield* Console.log("\n--- Agent Audits ---")
      }
      for (const report of agentReports) {
        yield* formatReport(report)
      }

      if (skillReports.length > 0) {
        yield* Console.log("\n--- Skill Audits ---")
      }
      for (const report of skillReports) {
        yield* formatReport(report)
      }

      const totalPassed = allReports.reduce((a, r) => a + r.summary.passed, 0)
      const totalWarned = allReports.reduce((a, r) => a + r.summary.warned, 0)
      const totalFailed = allReports.reduce((a, r) => a + r.summary.failed, 0)
      yield* Console.log(`\n=== Total: ${totalPassed} passed, ${totalWarned} warned, ${totalFailed} failed across ${allReports.length} files ===`)
    }).pipe(Effect.provide(AllAuditLayers))
)
