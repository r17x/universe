import { Command } from "effect/unstable/cli"
import { Console, Layer } from "effect"
import { hookListCommand } from "./hook.list"
import { hookEvalCommand } from "./hook.eval"
import { hookSyncCommand } from "./hook.sync"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { GuardEvaluator } from "./guard"

export const HookLayers = Layer.mergeAll(MachineLoader.layer, Config.layer, GuardEvaluator.layerWithMemory)

const hookParent = Command.make("hook", {}, () =>
  Console.log("Usage: anakmagang hook <list|eval|sync> ...")
)

export const hookCommand = Command.withSubcommands(hookParent, [hookListCommand, hookEvalCommand, hookSyncCommand])
