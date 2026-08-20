import { Array as Arr, Clock, Context, Effect, Layer, Option, Result } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { MemoryStore } from "./MemoryStore";
import { EventLog } from "./EventLog";
import { SessionId } from "./Ulid";
import { Bridge } from "./Bridge";
import { Config } from "./Config";
import {
  Allow,
  $is,
  emptyCurrentData,
  type CurrentData,
  type GuardContext,
  type GuardInput,
  type GuardResult,
  type HookInput,
  type HookEnv,
} from "./protocol.GuardResult";
// oxlint-disable-next-line consistent-type-imports -- BridgeData is used in typeof position
import {
  matchesTool,
  hashString,
  computeContextPct,
  BridgeData,
  type GuardConfig,
} from "./protocol.GuardConfig";
import { sortByBucket } from "./protocol.LatencyBucket";
import { makeGuardRegistry } from "./guard.registry";
import * as Yaml from "./Yaml";

export interface GuardEvaluatorContract {
  readonly evaluate: (ctx: GuardInput) => Effect.Effect<GuardResult>;
  readonly evaluateAll: (
    guards: ReadonlyArray<GuardConfig>,
    event: string,
    name: string | undefined,
    input: HookInput,
    env: HookEnv,
  ) => Effect.Effect<{
    readonly results: readonly GuardResult[];
    readonly guards: readonly GuardConfig[];
  }>;
}

const makeEvaluator = Effect.gen(function* () {
  const eventLog = yield* EventLog;
  const fs = yield* FileSystem;
  const p = yield* Path;
  const bridge = yield* Bridge;
  const config = yield* Config;

  const guardImplementations = makeGuardRegistry();

  const provide = <A, E>(
    effect: Effect.Effect<A, E, EventLog | FileSystem | Path | Bridge | Config>,
  ) =>
    effect.pipe(
      Effect.provideService(EventLog, eventLog),
      Effect.provideService(FileSystem, fs),
      Effect.provideService(Path, p),
      Effect.provideService(Bridge, bridge),
      Effect.provideService(Config, config),
    );

  const { isRecord } = Yaml;

  const parseConfigStores = (parsed: unknown): CurrentData["configStores"] => {
    if (!isRecord(parsed)) return [];
    const ground = parsed["ground"];
    if (!isRecord(ground) || !Array.isArray(ground["stores"])) return [];
    return Arr.filterMap(ground["stores"] as ReadonlyArray<unknown>, (s) =>
      isRecord(s) && s["kind"] === "Artifact"
        ? Result.succeed({
            path: String(s["path"] ?? ""),
            writable: Boolean(s["writable"] ?? true),
          } as const)
        : Result.fail(undefined),
    );
  };

  const readConfigStores = (projectDir: string) =>
    Effect.gen(function* () {
      const configPath = p.join(projectDir, ".anakmagang", "config.yaml");
      const content = yield* fs.readFileString(configPath).pipe(Effect.option);
      if (Option.isNone(content)) return [] as CurrentData["configStores"];
      return parseConfigStores(Yaml.parse(content.value));
    }).pipe(Effect.orElseSucceed(() => [] as CurrentData["configStores"]));

  const resolveCurrent = (
    input: HookInput,
    env: HookEnv,
  ): Effect.Effect<{ current: CurrentData; enrichedInput: HookInput }> =>
    Effect.gen(function* () {
      const base: CurrentData = { ...emptyCurrentData };

      const stdinPct = computeContextPct(input.context_window);
      const stdinContextPct =
        typeof stdinPct === "number"
          ? Option.some(stdinPct)
          : Option.none<typeof BridgeData.Type>();
      const earlyReturn = {
        current: { ...base, contextPct: stdinContextPct },
        enrichedInput: input,
      };

      if (!input.session_id) return earlyReturn;

      const resolved = yield* bridge
        .resolve(config.client, input.session_id)
        .pipe(Effect.orElseSucceed(() => Option.none()));
      if (Option.isNone(resolved)) return earlyReturn;

      const sid = resolved.value;

      const resolvedContext: { contextPct: Option.Option<number>; enrichedInput: HookInput } =
        typeof stdinPct === "number"
          ? { contextPct: Option.some(stdinPct), enrichedInput: input }
          : yield* bridge.read(sid, config.client, input.session_id).pipe(
              Effect.orElseSucceed(() => Option.none<typeof BridgeData.Type>()),
              Effect.map((data) =>
                data.pipe(
                  Option.flatMap((d) => Option.fromNullishOr(computeContextPct(d.context_window))),
                  Option.filter((v): v is number => typeof v === "number"),
                  Option.match({
                    onNone: () => ({
                      contextPct: Option.none<typeof BridgeData.Type>() as Option.Option<number>,
                      enrichedInput: input,
                    }),
                    onSome: (bridgePct) => ({
                      contextPct: Option.some(bridgePct),
                      enrichedInput: {
                        ...input,
                        context_window: { used_percentage: bridgePct },
                      } as HookInput,
                    }),
                  }),
                ),
              ),
            );
      const { contextPct, enrichedInput } = resolvedContext;

      const active = yield* eventLog.isActive(sid).pipe(Effect.orElseSucceed(() => false));
      const draft = yield* eventLog.isDraft(sid).pipe(Effect.orElseSucceed(() => false));
      const task = yield* eventLog.currentTask(sid).pipe(
        Effect.orElseSucceed(() => undefined),
        Effect.map(Option.fromNullishOr),
      );
      const phase = yield* eventLog.currentPhase(sid).pipe(
        Effect.orElseSucceed(() => undefined),
        Effect.map(Option.fromNullishOr),
      );

      const agentName = env.CLAUDE_AGENT_NAME;
      const iterationCount =
        agentName && Option.isSome(task)
          ? yield* eventLog
              .iterationCount(sid, agentName, hashString(task.value))
              .pipe(Effect.orElseSucceed(() => 0))
          : 0;

      const configStores = yield* readConfigStores(env.CLAUDE_PROJECT_DIR);

      return {
        current: {
          sessionId: Option.some(sid),
          task,
          phase,
          active,
          draft,
          contextPct,
          iterationCount,
          configStores,
        } satisfies CurrentData,
        enrichedInput,
      };
    }).pipe(Effect.orElseSucceed(() => ({ current: emptyCurrentData, enrichedInput: input })));

  const postGuardEffect = (guard: GuardConfig, current: CurrentData, env: HookEnv) =>
    guard.type !== "iteration-limit"
      ? Effect.void
      : current.sessionId.pipe(
          Option.flatMap((sid) =>
            Option.fromNullishOr(env.CLAUDE_AGENT_NAME).pipe(
              Option.filter((a) => a.length > 0),
              Option.flatMap((agent) =>
                current.task.pipe(Option.map((taskValue) => ({ sid, agent, taskValue }))),
              ),
            ),
          ),
          Option.match({
            onNone: () => Effect.void,
            onSome: ({ sid, agent, taskValue }) =>
              Clock.currentTimeMillis.pipe(
                Effect.flatMap((ms) =>
                  eventLog.appendLog(SessionId(sid), {
                    type: "iteration",
                    agent,
                    task_hash: hashString(taskValue),
                    ts: new Date(ms).toISOString(),
                  }),
                ),
                Effect.orElseSucceed(() => void 0),
              ),
          }),
        );

  const evaluate = Effect.fn("GuardEvaluator.evaluate")(function* (ctx: GuardInput) {
    const impl = guardImplementations[ctx.guard.type];
    if (impl === undefined) return Allow();
    const { current, enrichedInput } = yield* resolveCurrent(ctx.input, ctx.env);
    const result = yield* provide(impl({ ...ctx, input: enrichedInput, current }));
    yield* postGuardEffect(ctx.guard, current, ctx.env);
    return result;
  });

  const evaluateAll = Effect.fn("GuardEvaluator.evaluateAll")(function* (
    guards: ReadonlyArray<GuardConfig>,
    event: string,
    name: string | undefined,
    input: HookInput,
    env: HookEnv,
  ) {
    const { current, enrichedInput } = yield* resolveCurrent(input, env);
    const matching = Arr.filter(guards, (g) => {
      if (g.enabled === false) return false;
      if (g.event !== event) return false;
      if (name !== undefined && g.type !== name) return false;
      if (!matchesTool(g.matcher, enrichedInput.tool_name)) return false;
      return true;
    });
    const sorted = sortByBucket(matching);
    const go = (
      index: number,
      acc: readonly GuardResult[],
    ): Effect.Effect<readonly GuardResult[]> => {
      if (Arr.last(acc).pipe(Option.filter($is("Block")), Option.isSome))
        return Effect.succeed(acc);
      return Arr.get(sorted, index).pipe(
        Effect.fromOption,
        Effect.matchEffect({
          onFailure: () => Effect.succeed(acc),
          onSuccess: (guard) => {
            const ctx: GuardContext = { input: enrichedInput, env, guard, current };
            const impl = guardImplementations[guard.type];
            const evalGuard =
              impl === undefined
                ? Effect.succeed(Allow())
                : provide(impl(ctx)).pipe(Effect.tap(() => postGuardEffect(guard, current, env)));
            return evalGuard.pipe(Effect.flatMap((result) => go(index + 1, [...acc, result])));
          },
        }),
      );
    };
    const results = yield* go(0, []);

    return { results, guards: sorted };
  });

  return { evaluate, evaluateAll };
}).pipe(Effect.map((c) => GuardEvaluator.of(c)));

export class GuardEvaluator extends Context.Service<GuardEvaluator, GuardEvaluatorContract>()(
  "@anakmagang/GuardEvaluator",
) {
  static readonly bare = Layer.effect(GuardEvaluator, makeEvaluator);

  static readonly layer = GuardEvaluator.bare.pipe(
    Layer.provide(Bridge.layer),
    Layer.provide(EventLog.layer),
    Layer.provide(Config.layer),
  );

  static readonly layerWithMemory = GuardEvaluator.bare.pipe(
    Layer.provide(Bridge.layer),
    Layer.provide(Layer.mergeAll(EventLog.layer, MemoryStore.layerWithSearch)),
    Layer.provide(Config.layer),
  );
}
