import { Console } from "effect"
import { Command } from "effect/unstable/cli"
import { initCommand } from "./init"
import { searchCommand } from "./search.cmd"
import { hookCommand } from "./hook"
import { memoryCommand } from "./memory"
import { auditCommand } from "./audit"
import { statusCommand } from "./status"
import { stateCommand } from "./state.cmd"
import { updateCommand } from "./update.cmd"
import { startCommand } from "./start.cmd"
import { nextCommand } from "./next.cmd"
import { observeCommand } from "./observe.cmd"
import { dropCommand } from "./drop.cmd"
import { logsCommand } from "./logs.cmd"

const command = Command.make("anakmagang", {}, () =>
  Console.log("Anakmagang")
)

const app = Command.withSubcommands(command, [initCommand, searchCommand, hookCommand, memoryCommand, auditCommand, statusCommand, stateCommand, updateCommand, startCommand, nextCommand, observeCommand, dropCommand, logsCommand])

export const cli = Command.run(app, {
  version: "0.1.0"
})
