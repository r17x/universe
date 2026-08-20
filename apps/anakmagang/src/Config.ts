import { Array as Arr, Context, Effect, Layer, Option, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import * as Yaml from "./Yaml";
import { MachineConfig } from "./Machine";
import type { ProviderConfigType } from "./Machine";

export class ConfigNotFound extends Schema.TaggedErrorClass<ConfigNotFound>()("ConfigNotFound", {
  path: Schema.String,
  message: Schema.String,
}) {}
export interface ConfigContract {
  readonly root: string;
  readonly projectName: string;
  readonly configPath: string;
  readonly outDir: string;
  readonly socketPath: string;
  readonly webSocketPath: string;
  readonly readConfig: Effect.Effect<string, ConfigNotFound>;
  readonly client: string;
  readonly providers: readonly ProviderConfigType[];
  readonly initialPhase: string;
  readonly terminalPhase: string;
  readonly terminalLabel: string;
  readonly promises: readonly string[];
  readonly phaseIds: readonly string[];
}

const PhaseExtract = Schema.Struct({
  id: Schema.String,
  next: Schema.NullOr(Schema.String),
});

const GuardExtract = Schema.Struct({
  type: Schema.String,
  promises: Schema.optional(Schema.Array(Schema.String)),
});

const ConfigYamlExtract = Schema.Struct({
  phases: Schema.Array(PhaseExtract),
  guards: Schema.Array(GuardExtract),
});

const DEFAULT_PROMISES: readonly string[] = [
  "IMPLEMENTATION_COMPLETE",
  "VERIFICATION_PASSED",
  "VERIFICATION_FAILED",
  "IMPLEMENTATION_BLOCKED",
  "NEEDS_COORDINATOR_INPUT",
  "REVIEW_PASSED",
  "REVIEW_ISSUES_FOUND",
  "REVIEW_BLOCKED",
];

const INITIAL_PHASE_DEFAULT = "setup";
const TERMINAL_PHASE_DEFAULT = "completion";
const AGENT_STOP_GUARD_TYPE = "agent-stop-guard";
const DEFAULT_CLIENT = "claude";
const TERMINAL_LABEL = "completed";

export class Config extends Context.Service<Config, ConfigContract>()("@anakmagang/Config") {
  static readonly layer = Layer.effect(
    Config,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path;

      const readFile = Effect.fn("Config.readFile")(function* (filePath: string) {
        return yield* fs
          .readFileString(filePath)
          .pipe(
            Effect.mapError(
              () => new ConfigNotFound({ path: filePath, message: `File not found: ${filePath}` }),
            ),
          );
      });

      const cwd = path.resolve(".");

      const walkUp = (dir: string, depth: number): Effect.Effect<string, PlatformError> =>
        depth >= 10
          ? Effect.succeed(cwd)
          : fs.exists(path.join(dir, ".anakmagang", "config.yaml")).pipe(
              Effect.flatMap((exists) => {
                if (exists) return Effect.succeed(dir);
                const parent = path.dirname(dir);
                if (parent === dir) return Effect.succeed(cwd);
                return Effect.suspend(() => walkUp(parent, depth + 1));
              }),
            );

      const root = yield* walkUp(cwd, 0);
      const configPath = path.join(root, ".anakmagang", "config.yaml");

      const fileContent = yield* fs.readFileString(configPath).pipe(Effect.option);

      const extract = Option.isSome(fileContent)
        ? Option.some(
            yield* Effect.succeed(Yaml.parse(fileContent.value)).pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(ConfigYamlExtract)),
            ),
          )
        : Option.none<typeof ConfigYamlExtract.Type>();

      const phases = extract.pipe(Option.map((e) => e.phases));
      const guards = extract.pipe(Option.map((e) => e.guards));

      const initialPhase = phases.pipe(
        Option.flatMap(Arr.head),
        Option.map((p) => p.id),
        Option.getOrElse(() => INITIAL_PHASE_DEFAULT),
      );

      const terminalPhase = phases.pipe(
        Option.flatMap(Arr.findFirst((p) => p.next === null)),
        Option.map((p) => p.id),
        Option.getOrElse(() => TERMINAL_PHASE_DEFAULT),
      );

      const promises = guards.pipe(
        Option.flatMap(Arr.findFirst((g) => g.type === AGENT_STOP_GUARD_TYPE)),
        Option.flatMap((g) => Option.fromNullishOr(g.promises)),
        Option.getOrElse((): readonly string[] => DEFAULT_PROMISES),
      );

      const phaseIds = phases.pipe(
        Option.map(Arr.map((p) => p.id)),
        Option.getOrElse((): readonly string[] => []),
      );

      const projectName = path.basename(root);

      const providers = yield* fileContent.pipe(
        Option.map((content) =>
          Effect.succeed(Yaml.parse(content)).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(MachineConfig)),
            Effect.map((decoded) => decoded.ground.providers ?? []),
            Effect.orElseSucceed((): readonly ProviderConfigType[] => []),
          ),
        ),
        Option.getOrElse(() => Effect.succeed<readonly ProviderConfigType[]>([])),
      );

      const defaultClient =
        providers.length > 0 ? (providers[0]?.id ?? DEFAULT_CLIENT) : DEFAULT_CLIENT;

      return Config.of({
        root,
        projectName,
        configPath,
        outDir: path.join(root, ".anakmagang", "out"),
        socketPath: path.join(root, ".anakmagang", "events.sock"),
        webSocketPath: path.join(Bun.env.HOME ?? "", ".anakmagang", "events.sock"),
        readConfig: readFile(configPath),
        client: defaultClient,
        providers,
        initialPhase,
        terminalPhase,
        terminalLabel: TERMINAL_LABEL,
        promises,
        phaseIds,
      });
    }),
  );
}
