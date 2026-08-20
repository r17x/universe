import { Command, Flag } from "effect/unstable/cli";
import { Effect, Option } from "effect";
import { Output } from "./protocol.Output";
import { Diagnostic, Line } from "./protocol.Emission";
import { Path } from "effect/Path";
import { FileSystem } from "effect/FileSystem";
import { MachineLoader, MachineLoadError, generateInstructions } from "./MachineLoader";

export const instructionsCommand = Command.make(
  "instructions",
  {
    preset: Flag.string("preset").pipe(
      Flag.withAlias("p"),
      Flag.optional,
      Flag.withDescription("Load from bundled preset"),
    ),
    from: Flag.path("from").pipe(
      Flag.withAlias("f"),
      Flag.optional,
      Flag.withDescription("Load from custom config file"),
    ),
    target: Flag.directory("target").pipe(
      Flag.withAlias("t"),
      Flag.withDefault(
        Effect.gen(function* () {
          const p = yield* Path;
          return p.resolve(".");
        }),
      ),
      Flag.withDescription("Target project directory (defaults to cwd)"),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const loader = yield* MachineLoader;

      const preset = Option.getOrUndefined(config.preset);
      const from = Option.getOrUndefined(config.from);
      if (preset && from) {
        yield* output.emit(
          Diagnostic({ severity: "error", message: "Cannot use both --preset and --from" }),
        );
        return yield* new MachineLoadError({
          source: "instructions",
          message: "Conflicting config sources",
        });
      }

      const fs = yield* FileSystem;
      const path = yield* Path;
      const configPath = path.join(config.target, ".anakmagang", "config.yaml");
      const hasProjectConfig = yield* fs.exists(configPath).pipe(Effect.orElseSucceed(() => false));

      const machineConfig = from
        ? yield* loader.loadFromFile(from)
        : preset
          ? yield* loader.loadPreset(preset)
          : hasProjectConfig
            ? yield* loader.loadFromFile(configPath)
            : yield* loader.loadPreset("orchestrate");

      const instructionText = yield* generateInstructions(machineConfig, config.target);
      yield* output.emit(Line({ text: instructionText }));
    }).pipe(Effect.provide(MachineLoader.layer)),
);
