import { Command } from "effect/unstable/cli";
import * as Effect from "effect/Effect";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";
import { auditAgentsCommand } from "./audit.agents";
import { auditSkillsCommand } from "./audit.skills";
import { auditAllCommand } from "./audit.all";

const auditParent = Command.make("audit", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(Line({ text: "Usage: anakmagang audit <agents|skills|all>" }));
  }),
);

export const auditCommand = Command.withSubcommands(auditParent, [
  auditAgentsCommand,
  auditSkillsCommand,
  auditAllCommand,
]);
