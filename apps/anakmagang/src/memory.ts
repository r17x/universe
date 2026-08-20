import { Command } from "effect/unstable/cli";
import { Effect } from "effect";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";
import { memoryStatusCommand } from "./memory.status";
import { memoryCreateCommand } from "./memory.create";
import { memoryQueryCommand } from "./memory.query";
import { memoryPromoteCommand } from "./memory.promote";
import { memoryPruneCommand } from "./memory.prune";
import { memoryIndexCommand } from "./memory.index";
import { memoryResolveCommand } from "./memory.resolve";
import { memoryGraphCommand } from "./memory.graph";

const memoryParent = Command.make("memory", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(
      Line({
        text: "Usage: anakmagang memory <status|create|query|promote|prune|index|resolve|graph>",
      }),
    );
  }),
);

export const memoryCommand = Command.withSubcommands(memoryParent, [
  memoryStatusCommand,
  memoryCreateCommand,
  memoryQueryCommand,
  memoryPromoteCommand,
  memoryPruneCommand,
  memoryIndexCommand,
  memoryResolveCommand,
  memoryGraphCommand,
]);
