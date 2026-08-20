import { Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { MachineLoader } from "./MachineLoader";
import { Config } from "./Config";

import { Output } from "./protocol.Output";
import { Record } from "./protocol.Emission";

const HookEntrySchema = Schema.Struct({
  type: Schema.String,
  command: Schema.String,
  timeout: Schema.optional(Schema.Number),
});

const HookMatcherSchema = Schema.Struct({
  matcher: Schema.optional(Schema.String),
  hooks: Schema.Array(HookEntrySchema),
});

type HookMatcher = typeof HookMatcherSchema.Type;

export interface SyncableGuard {
  readonly event?: string | undefined;
  readonly enforced_by?: string | undefined;
  readonly matcher?: string | undefined;
  readonly timeout?: number | undefined;
}

export const syncHooksToSettings = (
  guards: ReadonlyArray<SyncableGuard>,
  rootDir: string,
  options?: { readonly refreshInterval?: number; readonly client?: string },
): Effect.Effect<string, never, FileSystem | Path | Config> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const path = yield* Path;
    const config = yield* Config;
    const client = options?.client ?? config.client;

    const hookGuards = Arr.filter(guards, (g) => g.event !== undefined && g.enforced_by === "hook");

    const eventGroups = Arr.groupBy(hookGuards, (g) => g.event ?? "");

    const hooks: Record<string, readonly HookMatcher[]> = Object.fromEntries(
      Object.entries(eventGroups).map(([event, eventGuards]) => {
        const maxTimeout = Math.max(...Arr.map(eventGuards, (g) => g.timeout ?? 5));
        return [
          event,
          [
            {
              matcher: "",
              hooks: [
                {
                  type: "command" as const,
                  command: `anakmagang hook eval --event ${event} --client ${client}`,
                  timeout: maxTimeout,
                },
              ],
            },
          ],
        ];
      }),
    );

    const provider = Arr.findFirst(config.providers, (pr) => pr.id === client);
    const settingsFile = provider.pipe(
      Option.flatMap((pr) => Option.fromNullishOr(pr.settings_file)),
      Option.getOrElse(() => "settings.json"),
    );
    const settingsPath = path.join(rootDir, `.${client}`, settingsFile);
    const existingExists = yield* fs.exists(settingsPath).pipe(Effect.orElseSucceed(() => false));

    const existing: Record<string, unknown> = existingExists
      ? yield* fs.readFileString(settingsPath).pipe(
          Effect.flatMap((raw) =>
            Schema.decodeUnknownEffect(
              Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
            )(raw),
          ),
          Effect.orElseSucceed((): Record<string, unknown> => ({})),
        )
      : {};

    const refreshInterval = options?.refreshInterval;
    const settings: Record<string, unknown> = {
      ...existing,
      hooks,
      statusLine: {
        type: "command",
        command: `anakmagang hook eval --event statusLine --client ${client}`,
        ...(refreshInterval !== undefined ? { refreshInterval } : {}),
      },
    };

    const output = yield* Schema.encodeEffect(
      Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
    )(settings).pipe(
      Effect.orElseSucceed(() => "{}"),
      Effect.map((s) => s + "\n"),
    );

    yield* fs
      .makeDirectory(path.join(rootDir, `.${client}`), { recursive: true })
      .pipe(Effect.orElseSucceed(() => void 0));
    yield* fs.writeFileString(settingsPath, output).pipe(Effect.orElseSucceed(() => void 0));

    return settingsPath;
  });

export const hookSyncCommand = Command.make(
  "sync",
  {
    client: Flag.string("client").pipe(
      Flag.optional,
      Flag.withDescription("Target client identifier for hook commands (defaults to config)"),
    ),
  },
  ({ client }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const config = yield* Config;
      const loader = yield* MachineLoader;
      const machine = yield* loader
        .loadFromFile(config.configPath)
        .pipe(Effect.orElseSucceed(() => undefined));
      const guards = machine?.guards ?? [];

      const ri = machine?.ground?.statusline?.refresh_interval;
      const clientStr = Option.getOrUndefined(client);
      const settingsPath = yield* syncHooksToSettings(guards, config.root, {
        ...(ri !== undefined ? { refreshInterval: ri } : {}),
        ...(clientStr !== undefined ? { client: clientStr } : {}),
      });

      const hookGuards = Arr.filter(
        guards,
        (g) => g.event !== undefined && g.enforced_by === "hook",
      );
      const eventGroups = new Set(Arr.map(hookGuards, (g) => g.event ?? ""));

      yield* output.emit(
        Record({
          fields: [
            ["synced", String(eventGroups.size)],
            ["target", settingsPath],
          ],
        }),
      );
    }).pipe(Effect.provide(Layer.merge(MachineLoader.layer, Config.layer))),
);
