import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Config } from "./Config";
import { EventLog } from "./EventLog";
import { MachineLoader } from "./MachineLoader";
import { MemoryStore } from "./MemoryStore";
import { PhaseEngine } from "./PhaseEngine";
import { DirtyBits } from "./DirtyBits";
import { GuardEvaluator } from "./guard";
import { Bridge } from "./Bridge";
import { ProviderResolver } from "./ProviderResolver";

const GuardEvaluatorLayers = GuardEvaluator.bare.pipe(
  Layer.provideMerge(Bridge.layer),
  Layer.provideMerge(EventLog.layer),
  Layer.provide(Config.layer),
);

export const PhaseEngineLayers = PhaseEngine.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      MachineLoader.layer,
      Config.layer,
      MemoryStore.layerWithSearch,
      EventLog.layer,
      DirtyBits.layer,
      GuardEvaluatorLayers,
    ),
  ),
);

export const ConfigEventLogLayers = Layer.mergeAll(Config.layer, EventLog.layer);

export const ConfigLayer = Config.layer;

export const EventLogLayers = ConfigEventLogLayers;

export const MachineLoaderLayers = Layer.mergeAll(MachineLoader.layer, Config.layer);

export const GuardLayers = GuardEvaluatorLayers.pipe(Layer.provideMerge(Config.layer));

export const ProviderResolverLayers = ProviderResolver.layer;

export const loadGuards = Effect.gen(function* () {
  const config = yield* Config;
  const loader = yield* MachineLoader;
  const machine = yield* loader.loadFromFile(config.configPath);
  return machine.guards ?? [];
});
