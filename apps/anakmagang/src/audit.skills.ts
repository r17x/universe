import { makeAuditCommand } from "./AuditShared";
import { SkillAuditor } from "./SkillAuditor";

export const auditSkillsCommand = makeAuditCommand({
  name: "skills",
  dirPrefix: ".claude/skills",
  auditorTag: SkillAuditor,
  layer: SkillAuditor.layer,
});
