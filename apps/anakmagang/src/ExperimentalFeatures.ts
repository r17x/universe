import { Array as Arr, Context, Effect, Layer } from "effect";
import { Config } from "./Config";
import { MachineLoader } from "./MachineLoader";

export interface ExperimentalFeaturesContract {
  readonly enabledPrompts: ReadonlyArray<string>;
}

export class ExperimentalFeatures extends Context.Service<
  ExperimentalFeatures,
  ExperimentalFeaturesContract
>()("@anakmagang/ExperimentalFeatures") {
  static readonly layer = Layer.effect(
    ExperimentalFeatures,
    Effect.gen(function* () {
      const config = yield* Config;
      const loader = yield* MachineLoader;
      const machine = yield* loader.loadFromFile(config.configPath);
      const experimental = machine.experimental ?? [];
      const enabledPrompts = Arr.map(
        Arr.filter(experimental, (e) => e.enabled),
        (e) => e.prompt,
      );
      return ExperimentalFeatures.of({ enabledPrompts });
    }),
  ).pipe(Layer.provide(Config.layer), Layer.provide(MachineLoader.layer));
}
