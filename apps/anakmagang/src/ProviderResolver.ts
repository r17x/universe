// Provider resolution: explicit flag → env vars → directory detection → config default → claude fallback

import { Array as Arr, Context, Effect, Layer, Option } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { Config } from "./Config";
import type { ProviderConfigType } from "./Machine";

export interface ProviderResolution {
  readonly providerId: string;
  readonly config: ProviderConfigType;
  readonly isExplicit: boolean;
  readonly source: "flag" | "env" | "directory" | "config" | "default";
}

export interface ProviderResolverContract {
  readonly resolve: (options?: { client?: string }) => Effect.Effect<ProviderResolution>;
  readonly getById: (id: string) => Effect.Effect<Option.Option<ProviderConfigType>>;
  readonly list: () => Effect.Effect<readonly ProviderConfigType[]>;
  readonly getPaths: (providerId: string) => Effect.Effect<{
    root: string;
    memories: string;
    skills: string;
    agents: string;
    settings: string | undefined;
    hooks: string | undefined;
  }>;
}

const CLAUDE_FALLBACK: ProviderConfigType = {
  id: "claude",
  directory: ".claude",
  memories_dir: "memories",
  skills_dir: "skills",
  agents_dir: "agents",
  settings_file: "settings.json",
};

const makeProviderResolver = Effect.gen(function* () {
  const config = yield* Config;
  const fs = yield* FileSystem;
  const p = yield* Path;

  const providers = config.providers;

  const getById = Effect.fn("ProviderResolver.getById")(function* (id: string) {
    return Arr.findFirst(providers, (provider) => provider.id === id);
  });

  const getParentDirs = (dir: string, depth: number): Effect.Effect<readonly string[]> =>
    depth <= 0
      ? Effect.succeed([])
      : Effect.gen(function* () {
          const parent = p.dirname(dir);
          if (parent === dir) return [];
          const parents = yield* getParentDirs(parent, depth - 1);
          return [parent, ...parents];
        });

  const detectFromDirectory = Effect.fn("ProviderResolver.detectFromDirectory")(function* () {
    const cwd = process.cwd();
    const parentDirs = yield* getParentDirs(cwd, 5);
    const allDirs = [cwd, ...parentDirs];
    const candidates = Arr.flatMap(allDirs, (dir) =>
      Arr.map(providers, (provider) => ({ dir, provider })),
    );
    const results = yield* Effect.forEach(candidates, ({ dir, provider }) =>
      fs.exists(p.join(dir, provider.directory)).pipe(
        Effect.orElseSucceed(() => false),
        Effect.map((exists) =>
          exists ? Option.some(provider) : Option.none<ProviderConfigType>(),
        ),
      ),
    );
    return Arr.findFirst(results, Option.isSome).pipe(Option.flatten);
  });

  const detectFromEnv = Effect.fn("ProviderResolver.detectFromEnv")(function* () {
    const candidates = Arr.flatMap(providers, (provider) =>
      provider.env_vars
        ? Arr.map(Object.entries(provider.env_vars), ([ourVar, theirVar]) => ({
            provider,
            ourVar,
            theirVar,
          }))
        : [],
    );
    return Arr.findFirst(
      candidates,
      ({ ourVar, theirVar }) =>
        process.env[theirVar] !== undefined || process.env[ourVar] !== undefined,
    ).pipe(Option.map(({ provider }) => provider));
  });

  const makeResolution = (
    provider: ProviderConfigType,
    isExplicit: boolean,
    source: ProviderResolution["source"],
  ): ProviderResolution => ({
    providerId: provider.id,
    config: provider,
    isExplicit,
    source,
  });

  const resolve = Effect.fn("ProviderResolver.resolve")(function* (options?: { client?: string }) {
    const explicit = Option.fromNullishOr(options?.client).pipe(
      Option.flatMap((id) => Arr.findFirst(providers, (prov) => prov.id === id)),
    );
    if (Option.isSome(explicit)) return makeResolution(explicit.value, true, "flag");

    const envProvider = yield* detectFromEnv();
    if (Option.isSome(envProvider)) return makeResolution(envProvider.value, false, "env");

    const dirProvider = yield* detectFromDirectory();
    if (Option.isSome(dirProvider)) return makeResolution(dirProvider.value, false, "directory");

    const configDefault = Arr.head(providers);
    if (Option.isSome(configDefault)) return makeResolution(configDefault.value, false, "config");

    return makeResolution(CLAUDE_FALLBACK, false, "default");
  });

  const getPaths = Effect.fn("ProviderResolver.getPaths")(function* (providerId: string) {
    const provider = yield* Arr.findFirst(providers, (prov) => prov.id === providerId).pipe(
      Effect.fromOption,
      Effect.orElseSucceed(() => CLAUDE_FALLBACK),
    );
    const root = p.join(config.root, provider.directory);
    return {
      root,
      memories: p.join(root, provider.memories_dir),
      skills: p.join(root, provider.skills_dir),
      agents: p.join(root, provider.agents_dir),
      settings: provider.settings_file ? p.join(root, provider.settings_file) : undefined,
      hooks: provider.hooks_file ? p.join(root, provider.hooks_file) : undefined,
    };
  });

  return {
    resolve,
    getById,
    list: () => Effect.succeed(providers),
    getPaths,
  };
}).pipe(Effect.map((c) => ProviderResolver.of(c)));

class ProviderResolver extends Context.Service<ProviderResolver, ProviderResolverContract>()(
  "@anakmagang/ProviderResolver",
) {
  static readonly layerNoDeps: Layer.Layer<ProviderResolver, never, Config | FileSystem | Path> =
    Layer.effect(ProviderResolver, makeProviderResolver);
  static readonly layer = ProviderResolver.layerNoDeps.pipe(Layer.provide(Config.layer));
}

export { ProviderResolver };
