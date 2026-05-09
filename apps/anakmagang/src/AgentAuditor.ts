import { Console, Context, Data, Effect, Layer, Schema } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { ArchParser, type DomainRoute } from "./ArchParser"
import * as Yaml from "./Yaml"

export const AuditResultSchema = Schema.Struct({
  phase: Schema.Number,
  check: Schema.String,
  status: Schema.Literals(["pass", "warn", "fail"]),
  message: Schema.String,
})
export type AuditResult = typeof AuditResultSchema.Type

export const AuditReportSchema = Schema.Struct({
  target: Schema.String,
  type: Schema.Literals(["agent", "skill"]),
  results: Schema.Array(AuditResultSchema),
  summary: Schema.Struct({
    passed: Schema.Number,
    warned: Schema.Number,
    failed: Schema.Number,
  }),
})
export type AuditReport = typeof AuditReportSchema.Type
export const AuditReportsSchema = Schema.Array(AuditReportSchema)

export class AuditError extends Data.TaggedError("AuditError")<{
  readonly target: string
  readonly message: string
}> {}

export const makeSummary = (results: readonly AuditResult[]) => ({
  passed: results.filter((r) => r.status === "pass").length,
  warned: results.filter((r) => r.status === "warn").length,
  failed: results.filter((r) => r.status === "fail").length,
})

export const formatReport = (report: AuditReport): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(`\n=== ${report.target} ===`)
    for (const r of report.results) {
      const icon = r.status === "pass" ? "OK" : r.status === "warn" ? "WARN" : "FAIL"
      yield* Console.log(`  [${icon}] Phase ${r.phase}: ${r.check} - ${r.message}`)
    }
    yield* Console.log(`  Summary: ${report.summary.passed} passed, ${report.summary.warned} warned, ${report.summary.failed} failed`)
  })

export interface AgentAuditorContract {
  readonly audit: (filePath: string) => Effect.Effect<AuditReport, AuditError>
  readonly auditAll: () => Effect.Effect<readonly AuditReport[], AuditError>
}

export class AgentAuditor extends Context.Service<AgentAuditor, AgentAuditorContract>()("@anakmagang/AgentAuditor") {
  static readonly layer = Layer.effect(
    AgentAuditor,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const p = yield* Path
      const archParser = yield* ArchParser

      const getRoutes = archParser.getDomainRouting().pipe(
        Effect.catch(() => Effect.succeed<readonly DomainRoute[]>([]))
      )

      const auditOne = Effect.fn("AgentAuditor.audit")(function* (filePath: string) {
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot read file" }))
        )
        const parsed = Yaml.parseFrontmatter(content)
        const results: AuditResult[] = []

        if (!parsed || !parsed.fm["name"] || !parsed.fm["description"]) {
          results.push({ phase: 1, check: "frontmatter", status: "fail", message: "Missing or invalid frontmatter (need name, description)" })
          Array.from({ length: 8 }, (_, i) => i + 2).forEach((phase) => {
            results.push({ phase, check: "skipped", status: "fail", message: "Skipped: frontmatter validation failed" })
          })
          return { target: filePath, type: "agent" as const, results, summary: makeSummary(results) } satisfies AuditReport
        }
        results.push({ phase: 1, check: "frontmatter", status: "pass", message: "Valid frontmatter" })

        const body = parsed.body
        const name = String(parsed.fm["name"])

        const hasToolSection = body.includes("USE") && (body.includes("DO NOT USE") || body.includes("DO NOT use"))
        results.push({ phase: 2, check: "tool-boundary", status: hasToolSection ? "pass" : "warn", message: hasToolSection ? "Tool permissions defined" : "No tool boundary section found" })

        const mentionsAgent = /\bAgent\b.*tool/i.test(body) || /DO NOT USE.*Agent/i.test(body)
        const forbidsAgent = /DO NOT.*Agent/i.test(body)
        if (mentionsAgent && forbidsAgent) {
          results.push({ phase: 3, check: "delegation", status: "pass", message: "Correctly forbids Agent tool" })
        } else if (mentionsAgent && !forbidsAgent) {
          results.push({ phase: 3, check: "delegation", status: "fail", message: "Mentions Agent tool without forbidding it" })
        } else {
          results.push({ phase: 3, check: "delegation", status: "warn", message: "No explicit Agent tool mention" })
        }

        const hasVerification = /verif/i.test(body) && body.includes("```")
        results.push({ phase: 4, check: "verification", status: hasVerification ? "pass" : "warn", message: hasVerification ? "Verification section found" : "No verification commands found" })

        const hasPromises = ["IMPLEMENTATION_COMPLETE", "VERIFICATION_PASSED", "VERIFICATION_FAILED"].some((s) => body.includes(s))
        results.push({ phase: 5, check: "completion-promises", status: hasPromises ? "pass" : "warn", message: hasPromises ? "Completion promises defined" : "No completion promise strings found" })

        const hasSkillRefs = body.includes(".claude/skills/") || body.includes("skill")
        results.push({ phase: 6, check: "skill-refs", status: "pass", message: hasSkillRefs ? "Skill references found" : "No skill references (informational)" })

        const lineCount = content.split("\n").length
        results.push({ phase: 7, check: "size", status: lineCount <= 150 ? "pass" : "warn", message: `${lineCount} lines (limit: 150)` })

        const routes = yield* getRoutes
        const inRouting = routes.some((r) => r.workerAgent === name)
        results.push({ phase: 8, check: "arch-alignment", status: inRouting ? "pass" : "warn", message: inRouting ? `Found in ARCHITECTURE.md routing as "${name}"` : `"${name}" not found in domain routing table` })

        const hasOutput = /output|result|format/i.test(body) && body.includes("```")
        results.push({ phase: 9, check: "output-format", status: hasOutput ? "pass" : "warn", message: hasOutput ? "Output format defined" : "No structured output format found" })

        return { target: filePath, type: "agent" as const, results, summary: makeSummary(results) } satisfies AuditReport
      })

      return {
        audit: auditOne,
        auditAll: Effect.fn("AgentAuditor.auditAll")(function* () {
          const agentsDir = p.resolve(".claude", "agents")
          const exists = yield* fs.exists(agentsDir).pipe(Effect.orDie)
          if (!exists) { const empty: readonly AuditReport[] = []; return empty }
          const entries = yield* fs.readDirectory(agentsDir).pipe(Effect.orDie)
          const mdFiles = entries.filter((e) => e.endsWith(".md"))
          const reports = yield* Effect.forEach(mdFiles, (file) =>
            auditOne(p.join(agentsDir, file))
          , { concurrency: "unbounded" })
          return reports
        }),
      }
    })
  )
}
