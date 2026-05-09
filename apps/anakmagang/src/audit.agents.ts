import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Layer, Option, Schema } from "effect"
import { AgentAuditor, AuditReportsSchema, formatReport } from "./AgentAuditor"
import { ArchParser } from "./ArchParser"

const AuditLayers = Layer.provideMerge(AgentAuditor.layer, ArchParser.layer)

export const auditAgentsCommand = Command.make(
  "agents",
  {
    name: Argument.string("name").pipe(Argument.withSchema(Schema.NonEmptyString), Argument.optional),
    format: Flag.choice("format", ["human", "json"] as const).pipe(Flag.withAlias("f"), Flag.withDefault("human" as const)),
  },
  ({ name, format }) =>
    Effect.gen(function* () {
      const auditor = yield* AgentAuditor
      const reports = Option.isSome(name)
        ? [yield* auditor.audit(`.claude/agents/${name.value}.md`)]
        : yield* auditor.auditAll()

      if (format === "json") {
        const json = yield* Schema.encodeEffect(Schema.fromJsonString(AuditReportsSchema))(reports)
        yield* Console.log(json)
        return
      }

      for (const report of reports) {
        yield* formatReport(report)
      }
    }).pipe(Effect.provide(AuditLayers))
)
