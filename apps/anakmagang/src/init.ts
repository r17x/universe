import { Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, Option } from "effect";
import { Output } from "./protocol.Output";
import { Diagnostic, Line } from "./protocol.Emission";
import { Path } from "effect/Path";
import { FileSystem } from "effect/FileSystem";
import { MachineLoader, MachineLoadError } from "./MachineLoader";
import { syncHooksToSettings } from "./hook.sync";

export const initCommand = Command.make(
  "init",
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
    force: Flag.boolean("force").pipe(
      Flag.withAlias("F"),
      Flag.withDefault(false),
      Flag.withDescription("Overwrite existing config"),
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
          source: "init",
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

      yield* output.emit(Line({ text: `Initializing ${machineConfig.name} in ${config.target}` }));

      const results = yield* loader.generate(machineConfig, config.target, { force: config.force });

      const created = Arr.filter(results, (r) => r.status === "created");
      const skipped = Arr.filter(results, (r) => r.status === "skipped");
      const updated = Arr.filter(results, (r) => r.status === "updated");

      if (created.length > 0) {
        yield* output.emit(Line({ text: `Created ${created.length} file(s):` }));
        yield* Effect.forEach(created, (f) => output.emit(Line({ text: `  + ${f.path}` })));
      }
      if (updated.length > 0) {
        yield* output.emit(Line({ text: `Updated ${updated.length} file(s):` }));
        yield* Effect.forEach(updated, (f) => output.emit(Line({ text: `  ~ ${f.path}` })));
      }
      if (skipped.length > 0) {
        yield* output.emit(Line({ text: `Skipped ${skipped.length} file(s) (already exist)` }));
      }

      const guardsWithEvents = Arr.filter(
        machineConfig.guards ?? [],
        (g) => g.event !== undefined && g.enforced_by === "hook",
      );
      if (guardsWithEvents.length > 0) {
        const settingsPath = yield* syncHooksToSettings(machineConfig.guards ?? [], config.target);
        yield* output.emit(Line({ text: `Synced hooks to ${settingsPath}` }));
      }

      yield* output.emit(Line({ text: "Done." }));
    }).pipe(Effect.provide(MachineLoader.layer)),
);
