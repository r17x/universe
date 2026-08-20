import * as Effect from "effect/Effect";
import { Command } from "effect/unstable/cli";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";
import { initCommand } from "./init";
import { instructionsCommand } from "./instructions";
import { searchCommand } from "./search.cmd";
import { hookCommand } from "./hook";
import { memoryCommand } from "./memory";
import { auditCommand } from "./audit";
import { stateCommand } from "./state.cmd";
import { updateCommand } from "./update.cmd";
import { startCommand } from "./start.cmd";
import { evalCommand } from "./eval.cmd";
import { resumeCommand } from "./resume.cmd";
import { failCommand } from "./fail.cmd";
import { dropCommand } from "./drop.cmd";
import { draftCommand } from "./draft.cmd";
import { configCommand } from "./config.cmd";
import { queryCommand } from "./query.cmd";
import { webCommand } from "./web.cmd";

const command = Command.make("anakmagang", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(Line({ text: "Anakmagang" }));
  }),
);

const app = Command.withSubcommands(command, [
  initCommand,
  instructionsCommand,
  searchCommand,
  hookCommand,
  memoryCommand,
  auditCommand,
  stateCommand,
  updateCommand,
  startCommand,
  evalCommand,
  resumeCommand,
  failCommand,
  dropCommand,
  draftCommand,
  configCommand,
  queryCommand,
  webCommand,
]);

export const cli = Command.runWith(app, {
  version: "0.1.0",
});
