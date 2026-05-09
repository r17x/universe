import { Command } from "effect/unstable/cli"
import { Console } from "effect"
import { auditAgentsCommand } from "./audit.agents"
import { auditSkillsCommand } from "./audit.skills"
import { auditAllCommand } from "./audit.all"

const auditParent = Command.make("audit", {}, () =>
  Console.log("Usage: anakmagang audit <agents|skills|all>")
)

export const auditCommand = Command.withSubcommands(auditParent, [auditAgentsCommand, auditSkillsCommand, auditAllCommand])
