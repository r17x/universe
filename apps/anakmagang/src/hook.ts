import { Command } from "effect/unstable/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";
import { hookListCommand } from "./hook.list";
import { hookEvalCommand } from "./hook.eval";
import { hookSyncCommand } from "./hook.sync";
import { MachineLoader } from "./MachineLoader";
import { Config } from "./Config";
import { EventLog } from "./EventLog";
import { GuardEvaluator } from "./guard";
import { Bridge } from "./Bridge";
import { ExperimentalFeatures } from "./ExperimentalFeatures";

export const HookLayers = Layer.mergeAll(
  MachineLoader.layer,
  Config.layer,
  EventLog.layer,
  GuardEvaluator.layerWithMemory,
  Bridge.layer.pipe(Layer.provide(EventLog.layer)),
  ExperimentalFeatures.layer,
);

const hookParent = Command.make("hook", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(Line({ text: "Usage: anakmagang hook <list|eval|sync> ..." }));
  }),
);

export const hookCommand = Command.withSubcommands(hookParent, [
  hookListCommand,
  hookEvalCommand,
  hookSyncCommand,
]);
