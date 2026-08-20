import { Layer } from "effect";
import { makeAuditCommand } from "./AuditShared";
import { AgentAuditor } from "./AgentAuditor";
import { Config } from "./Config";
import { MachineLoader } from "./MachineLoader";

export const auditAgentsCommand = makeAuditCommand({
  name: "agents",
  dirPrefix: ".claude/agents",
  auditorTag: AgentAuditor,
  layer: Layer.provide(AgentAuditor.layer, Layer.merge(Config.layer, MachineLoader.layer)),
});
