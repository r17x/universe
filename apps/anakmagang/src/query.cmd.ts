import { Argument, Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, Layer, Option, pipe, Schema } from "effect";
import { Search } from "./Search";
import { MemoryStore } from "./MemoryStore";
import { EventLog, type EventLogError } from "./EventLog";
import { Config } from "./Config";
import { Output } from "./protocol.Output";
import { Record } from "./protocol.Emission";

type ScopeTag = "files" | "grep" | "memory" | "sessions";

type ResultRecord = {
  readonly scope: ScopeTag;
  readonly type: string;
  readonly identifier: string;
  readonly match: string;
};

const scopeEnabled = (selected: "all" | ScopeTag, target: ScopeTag) =>
  selected === "all" || selected === target;

const searchFiles = (
  query: string,
  limit: number,
): Effect.Effect<readonly ResultRecord[], never, Search> =>
  Effect.gen(function* () {
    const search = yield* Search;
    const result = yield* search.findMixed(query, {});
    return Arr.map(
      Arr.take(Arr.zip(result.items, result.scores), limit),
      ([item, score]): ResultRecord => ({
        scope: "files",
        type: item.type,
        identifier: item.path,
        match: `score=${score.total}`,
      }),
    );
  }).pipe(Effect.orElseSucceed((): readonly ResultRecord[] => []));

const searchGrep = (
  query: string,
  limit: number,
  glob: Option.Option<string>,
): Effect.Effect<readonly ResultRecord[], never, Search> =>
  Effect.gen(function* () {
    const search = yield* Search;
    const result = yield* search.grep(query, {
      glob: Option.getOrUndefined(glob),
      limit,
    });
    return Arr.map(
      result.items,
      (item): ResultRecord => ({
        scope: "grep",
        type: "match",
        identifier: `${item.path}:${item.lineNumber}`,
        match: item.lineContent,
      }),
    );
  }).pipe(Effect.orElseSucceed((): readonly ResultRecord[] => []));

const searchMemory = (
  query: string,
  limit: number,
): Effect.Effect<readonly ResultRecord[], never, MemoryStore> =>
  Effect.gen(function* () {
    const store = yield* MemoryStore;
    const nodes = yield* store.query(query.split(/\s+/));
    return Arr.map(
      Arr.take(nodes, limit),
      (n): ResultRecord => ({
        scope: "memory",
        type: n.scale,
        identifier: n.id,
        match: n.name,
      }),
    );
  });

const searchSessions = (
  query: string,
  limit: number,
): Effect.Effect<readonly ResultRecord[], EventLogError, EventLog> =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const sessions = yield* eventLog.listSessions();
    const lowerQuery = query.toLowerCase();

    const allResults = yield* Effect.forEach(sessions, (sid) =>
      Effect.gen(function* () {
        const task = yield* eventLog.lastTaskName(sid);
        const observations = yield* eventLog.observations(sid);
        const reflections = yield* eventLog.reflections(sid);

        const taskMatches: readonly ResultRecord[] =
          task !== undefined && task.toLowerCase().includes(lowerQuery)
            ? [{ scope: "sessions" as const, type: "task", identifier: sid, match: task }]
            : [];

        const obsMatches = Arr.filter(
          Arr.map(observations, (obs): ResultRecord | null =>
            obs.toLowerCase().includes(lowerQuery)
              ? { scope: "sessions", type: "observation", identifier: sid, match: obs }
              : null,
          ),
          (r): r is ResultRecord => r !== null,
        );

        const refMatches = Arr.filter(
          Arr.map(reflections, (r): ResultRecord | null =>
            r.reflection.toLowerCase().includes(lowerQuery)
              ? { scope: "sessions", type: "reflection", identifier: sid, match: r.reflection }
              : null,
          ),
          (r): r is ResultRecord => r !== null,
        );

        const rawEvents = yield* eventLog.readRawEvents(sid);
        const artifactEvents = Arr.filter(rawEvents, (e) => e.type === "artifact_add");
        const artifactMatches = Arr.filter(
          Arr.map(artifactEvents, (e): ResultRecord | null => {
            const tags = e["tags"] ?? "";
            const path = e["path"] ?? "";
            return tags.toLowerCase().includes(lowerQuery) ||
              path.toLowerCase().includes(lowerQuery)
              ? { scope: "sessions", type: "artifact", identifier: sid, match: path }
              : null;
          }),
          (r): r is ResultRecord => r !== null,
        );

        return [...taskMatches, ...obsMatches, ...refMatches, ...artifactMatches];
      }),
    );

    return Arr.take(Arr.flatten(allResults), limit);
  });

const QueryLayers = Layer.mergeAll(Search.layer, MemoryStore.layer, EventLog.layer, Config.layer);

export const queryCommand = Command.make(
  "query",
  {
    query: Argument.string("query").pipe(Argument.withSchema(Schema.NonEmptyString)),
    scope: Flag.choice("scope", ["files", "grep", "memory", "sessions", "all"] as const).pipe(
      Flag.withDefault("all" as const),
    ),
    glob: Flag.string("glob").pipe(Flag.optional),
    limit: Flag.integer("limit").pipe(Flag.withDefault(10)),
    client: Flag.string("client").pipe(Flag.optional),
  },
  ({ query, scope, glob, limit, client: _client }) =>
    Effect.gen(function* () {
      const output = yield* Output;

      const scopeDispatch: ReadonlyArray<
        readonly [
          ScopeTag,
          Effect.Effect<readonly ResultRecord[], never, Search | MemoryStore | EventLog>,
        ]
      > = [
        ["files", searchFiles(query, limit)],
        ["grep", searchGrep(query, limit, glob)],
        ["memory", searchMemory(query, limit)],
        [
          "sessions",
          searchSessions(query, limit).pipe(
            Effect.orElseSucceed((): readonly ResultRecord[] => []),
          ),
        ],
      ];

      const effects = pipe(
        scopeDispatch,
        Arr.filter(([tag]) => scopeEnabled(scope, tag)),
        Arr.map(([, effect]) => effect),
      );

      const results = yield* Effect.all(effects, { concurrency: "unbounded" });
      const allResults = Arr.flatten(results);

      yield* Effect.forEach(allResults, (r) =>
        output.emit(
          Record({
            fields: [
              ["scope", r.scope],
              ["type", r.type],
              ["id", r.identifier],
              ["match", r.match],
            ],
          }),
        ),
      );

      const countByScope = Arr.reduce(
        allResults,
        {} as globalThis.Record<string, number>,
        (acc, r) => ({
          ...acc,
          [r.scope]: (acc[r.scope] ?? 0) + 1,
        }),
      );

      yield* output.emit(
        Record({
          fields: [
            ["total", String(allResults.length)],
            ...Object.entries(countByScope).map(([s, c]): readonly [string, string] => [
              s,
              String(c),
            ]),
          ],
        }),
      );
    }).pipe(Effect.scoped, Effect.provide(QueryLayers)),
);
