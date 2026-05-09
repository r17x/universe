import { Command } from "effect/unstable/cli"
import { Console } from "effect"
import { memoryStatusCommand } from "./memory.status"
import { memoryCreateCommand } from "./memory.create"
import { memoryQueryCommand } from "./memory.query"
import { memoryPromoteCommand } from "./memory.promote"
import { memoryPruneCommand } from "./memory.prune"
import { memoryIndexCommand } from "./memory.index"
import { memoryResolveCommand } from "./memory.resolve"

const memoryParent = Command.make("memory", {}, () =>
  Console.log("Usage: anakmagang memory <status|create|query|promote|prune|index|resolve>")
)

export const memoryCommand = Command.withSubcommands(memoryParent, [
  memoryStatusCommand,
  memoryCreateCommand,
  memoryQueryCommand,
  memoryPromoteCommand,
  memoryPruneCommand,
  memoryIndexCommand,
  memoryResolveCommand,
])
