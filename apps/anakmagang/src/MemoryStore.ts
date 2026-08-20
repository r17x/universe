import { Array as Arr, Context, Effect, HashSet, Layer, Option, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { Config } from "./Config";
import { Search, type SearchContract } from "./Search";
import type { GrepResult } from "./FFF";
import * as Yaml from "./Yaml";
import { MemoryStoreEntry } from "./Machine";
export * from "./MemoryParser";
import {
  type MemoryNode,
  type MemoryNodeInput,
  type MemoryFilter,
  type MemoryStatus,
  MemoryNodeError,
  scaleOrder,
  toId,
  todayString,
  parseMemoryFrontmatter,
  serializeNode,
  matchesFilter,
  increment,
} from "./MemoryParser";

export interface MemoryDir {
  readonly path: string;
  readonly source: string;
}

export const FALLBACK_MEMORY_DIRS: readonly MemoryDir[] = [
  { path: ".claude/memories", source: "permanent" },
];

export interface MemoryStoreContract {
  readonly create: (input: MemoryNodeInput) => Effect.Effect<MemoryNode, MemoryNodeError>;
  readonly read: (id: string) => Effect.Effect<MemoryNode, MemoryNodeError>;
  readonly list: (filter?: MemoryFilter) => Effect.Effect<readonly MemoryNode[]>;
  readonly query: (
    keywords: readonly string[],
    filter?: MemoryFilter,
  ) => Effect.Effect<readonly MemoryNode[]>;
  readonly transition: (
    id: string,
    to: "ACTIVE" | "STALE" | "ARCHIVED",
  ) => Effect.Effect<MemoryNode, MemoryNodeError>;
  readonly promote: (
    id: string,
    derivedFromIds: readonly string[],
  ) => Effect.Effect<MemoryNode, MemoryNodeError>;
  readonly prune: (
    thresholds: Record<string, number>,
  ) => Effect.Effect<readonly MemoryNode[], MemoryNodeError>;
  readonly status: () => Effect.Effect<MemoryStatus>;
}

export const makeStoreContract = (dirs: readonly MemoryDir[], search?: SearchContract) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const p = yield* Path;

    const resolvedDirs = Arr.map(dirs, (d) => ({ ...d, resolved: p.resolve(d.path) }));

    yield* Effect.forEach(resolvedDirs, (d) =>
      fs
        .makeDirectory(d.resolved, { recursive: true })
        .pipe(
          Effect.mapError(
            () =>
              new MemoryNodeError({ id: d.resolved, message: `Failed to create memory directory` }),
          ),
        ),
    );

    const dirForSource = (source: string): Effect.Effect<string, MemoryNodeError> =>
      Arr.findFirst(resolvedDirs, (d) => d.source === source).pipe(
        Option.map((d) => d.resolved),
        Effect.fromOption,
        Effect.mapError(
          () =>
            new MemoryNodeError({
              id: source,
              message: `Unknown memory source: ${source}. Valid sources: ${Arr.map(resolvedDirs, (d) => d.source).join(", ")}`,
            }),
        ),
      );

    const filePath = (id: string, source: string): Effect.Effect<string, MemoryNodeError> =>
      dirForSource(source).pipe(Effect.map((dir) => p.join(dir, `${id}.md`)));

    const writeAtomic = Effect.fn("MemoryStore.writeAtomic")(function* (
      target: string,
      content: string,
    ) {
      const tmp = `${target}.tmp`;
      yield* fs
        .writeFileString(tmp, content)
        .pipe(
          Effect.mapError(
            () => new MemoryNodeError({ id: target, message: `Failed to write temp file: ${tmp}` }),
          ),
        );
      yield* fs
        .rename(tmp, target)
        .pipe(
          Effect.mapError(
            () =>
              new MemoryNodeError({ id: target, message: `Failed to rename: ${tmp} -> ${target}` }),
          ),
        );
    });

    const writeBatch = Effect.fn("MemoryStore.writeBatch")(function* (
      writes: ReadonlyArray<{ target: string; content: string }>,
    ) {
      const temps = yield* Effect.forEach(writes, ({ target, content }) => {
        const tmp = `${target}.tmp`;
        return fs.writeFileString(tmp, content).pipe(
          Effect.as(tmp),
          Effect.mapError(
            () =>
              new MemoryNodeError({ id: target, message: `Batch write failed at temp: ${tmp}` }),
          ),
        );
      });
      yield* Effect.forEach(Arr.zip(writes, temps), ([{ target }, tmp]) =>
        fs.rename(tmp, target).pipe(
          Effect.mapError(
            () =>
              new MemoryNodeError({
                id: target,
                message: `Batch rename failed: ${tmp} -> ${target}`,
              }),
          ),
        ),
      );
    });

    const findNodeFile = Effect.fn("MemoryStore.findNodeFile")(function* (id: string) {
      const found = yield* Effect.forEach(resolvedDirs, (d) => {
        const fp = p.join(d.resolved, `${id}.md`);
        return fs.exists(fp).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((exists) => (exists ? Option.some(fp) : Option.none())),
        );
      });
      return yield* Arr.findFirst(found, Option.isSome).pipe(
        Option.flatMap((x) => x),
        Effect.fromOption,
        Effect.mapError(() => new MemoryNodeError({ id, message: `Memory node not found: ${id}` })),
      );
    });

    const readNode = Effect.fn("MemoryStore.readNode")(function* (id: string) {
      const fp = yield* findNodeFile(id);
      const content = yield* fs
        .readFileString(fp)
        .pipe(
          Effect.mapError(
            () => new MemoryNodeError({ id, message: `Memory node not found: ${id}` }),
          ),
        );
      return yield* parseMemoryFrontmatter(content, id);
    });

    const writeNode = Effect.fn("MemoryStore.writeNode")(function* (node: MemoryNode) {
      const target = yield* filePath(node.id, node.source);
      yield* writeAtomic(target, serializeNode(node));
      return node;
    });

    const listAll = Effect.fn("MemoryStore.listAll")(function* () {
      const nested = yield* Effect.forEach(resolvedDirs, (d) =>
        Effect.gen(function* () {
          const dirExists = yield* fs.exists(d.resolved).pipe(Effect.orElseSucceed(() => false));
          if (!dirExists) return [];
          const entries = yield* fs
            .readDirectory(d.resolved)
            .pipe(Effect.orElseSucceed(() => [] as string[]));
          const mdFiles = Arr.filter(entries, (e) => e.endsWith(".md"));
          const results = yield* Effect.forEach(
            mdFiles,
            (file) => {
              const id = file.replace(/\.md$/, "");
              const fp = p.join(d.resolved, file);
              return fs.readFileString(fp).pipe(
                Effect.flatMap((content) => parseMemoryFrontmatter(content, id)),
                Effect.catch(() => Effect.succeed(null)),
              );
            },
            { concurrency: "unbounded" },
          );
          return Arr.filter(results, (n): n is MemoryNode => n !== null);
        }),
      );
      return Arr.flatten(nested);
    });

    const create = Effect.fn("MemoryStore.create")(function* (input: MemoryNodeInput) {
      const id = toId(input.name);
      if (id === "") {
        return yield* new MemoryNodeError({ id: "", message: "Cannot generate id from name" });
      }
      const existsCheck = yield* Effect.forEach(resolvedDirs, (d) => {
        const fp = p.join(d.resolved, `${id}.md`);
        return fs.exists(fp).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((exists) => (exists ? Option.some(fp) : Option.none())),
        );
      });
      const alreadyExists = Arr.findFirst(existsCheck, Option.isSome);
      if (Option.isSome(alreadyExists)) {
        return yield* new MemoryNodeError({ id, message: `Memory node already exists: ${id}` });
      }
      const node: MemoryNode = {
        id,
        name: input.name,
        description: input.description,
        type: input.type,
        scale: input.scale ?? "observation",
        state: "ACTIVE",
        updated: yield* todayString,
        session_count: 0,
        edges: { derived_from: [] },
        tags: input.tags ? [...input.tags] : [],
        body: input.body ?? "",
        source: input.source ?? "permanent",
      };
      return yield* writeNode(node);
    });

    const read = readNode;

    const list = Effect.fn("MemoryStore.list")(function* (filter?: MemoryFilter) {
      const all = yield* listAll();
      if (filter === undefined) return all;
      return Arr.filter(all, (n) => matchesFilter(n, filter));
    });

    const query = Effect.fn("MemoryStore.query")(function* (
      keywords: readonly string[],
      filter?: MemoryFilter,
    ) {
      if (keywords.length === 0) {
        const all = yield* listAll();
        return filter ? Arr.filter(all, (n) => matchesFilter(n, filter)) : all;
      }

      if (!search) {
        const all = yield* listAll();
        const lowerKeywords = Arr.map(keywords, (k) => k.toLowerCase());
        const matched = Arr.filter(all, (n) => {
          const text = `${n.name} ${n.description} ${n.body}`.toLowerCase();
          return lowerKeywords.some((kw) => text.includes(kw));
        });
        return filter ? Arr.filter(matched, (n) => matchesFilter(n, filter)) : matched;
      }

      const globPaths = Arr.map(
        resolvedDirs,
        (d) => p.relative(p.resolve("."), d.resolved) + "/*.md",
      );

      const nested = yield* Effect.forEach(globPaths, (globPath) =>
        Effect.gen(function* () {
          const grepResult = yield* search
            .multiGrep([...keywords], { glob: globPath, limit: 50 })
            .pipe(
              Effect.catch(() =>
                Effect.succeed({
                  items: [],
                  totalMatched: 0,
                  totalFilesSearched: 0,
                  totalFiles: 0,
                  filteredFileCount: 0,
                  nextFileOffset: 0,
                  regexFallbackError: null,
                } satisfies GrepResult),
              ),
            );
          if (grepResult.items.length === 0) return [];

          const uniquePaths = Arr.dedupe(Arr.map(grepResult.items, (item) => item.path));
          const nodes = yield* Effect.forEach(
            uniquePaths,
            (matchedPath) => {
              const id = p.basename(matchedPath).replace(/\.md$/, "");
              return fs.readFileString(matchedPath).pipe(
                Effect.flatMap((content) => parseMemoryFrontmatter(content, id)),
                Effect.catch(() => Effect.succeed(null)),
              );
            },
            { concurrency: "unbounded" },
          );
          return Arr.filter(nodes, (n): n is MemoryNode => n !== null);
        }),
      );
      const allNodes = Arr.flatten(nested);

      return filter ? Arr.filter(allNodes, (n) => matchesFilter(n, filter)) : allNodes;
    });

    const transition = Effect.fn("MemoryStore.transition")(function* (
      id: string,
      to: "ACTIVE" | "STALE" | "ARCHIVED",
    ) {
      const node = yield* readNode(id);
      const today = yield* todayString;
      const updated: MemoryNode = { ...node, state: to, updated: today };
      return yield* writeNode(updated);
    });

    type CycleState = {
      readonly queue: ReadonlyArray<string>;
      readonly visited: HashSet.HashSet<string>;
      readonly depth: number;
    };

    const bfsStep = (
      targetId: string,
      maxDepth: number,
      state: CycleState,
    ): Effect.Effect<boolean> =>
      Effect.suspend(() => {
        if (state.queue.length === 0 || state.depth >= maxDepth) return Effect.succeed(false);
        const current = state.queue[0] ?? "";
        const rest = state.queue.slice(1);
        if (current === targetId) return Effect.succeed(true);
        if (HashSet.has(state.visited, current))
          return bfsStep(targetId, maxDepth, {
            queue: rest,
            visited: state.visited,
            depth: state.depth + 1,
          });
        const nextVisited = HashSet.add(state.visited, current);
        return readNode(current).pipe(
          Effect.catch(() => Effect.succeed(null)),
          Effect.flatMap((node) => {
            const nextQueue =
              node === null
                ? rest
                : [
                    ...rest,
                    ...Arr.filter(node.edges.derived_from, (pid) => !HashSet.has(nextVisited, pid)),
                  ];
            return bfsStep(targetId, maxDepth, {
              queue: nextQueue,
              visited: nextVisited,
              depth: state.depth + 1,
            });
          }),
        );
      });

    const wouldCreateCycle = Effect.fn("MemoryStore.wouldCreateCycle")(function* (
      targetId: string,
      candidateId: string,
      maxDepth = 10,
    ) {
      return yield* bfsStep(targetId, maxDepth, {
        queue: [candidateId],
        visited: HashSet.empty<string>(),
        depth: 0,
      });
    });

    const promote = Effect.fn("MemoryStore.promote")(function* (
      id: string,
      derivedFromIds: readonly string[],
    ) {
      const node = yield* readNode(id);
      if (node.state !== "ACTIVE") {
        return yield* new MemoryNodeError({
          id,
          message: `Cannot promote non-ACTIVE node (state: ${node.state})`,
        });
      }
      const currentIdx = scaleOrder.indexOf(node.scale);
      if (currentIdx === -1 || currentIdx >= scaleOrder.length - 1) {
        return yield* new MemoryNodeError({
          id,
          message: `Cannot promote beyond principle (current: ${node.scale})`,
        });
      }
      yield* Effect.forEach(derivedFromIds, (depId) => {
        if (depId === id) {
          return Effect.fail(
            new MemoryNodeError({ id, message: "Self-referencing edge not allowed" }),
          );
        }
        return findNodeFile(depId).pipe(
          Effect.mapError(
            () => new MemoryNodeError({ id, message: `Derived-from node not found: ${depId}` }),
          ),
        );
      });
      yield* Effect.forEach(derivedFromIds, (depId) =>
        wouldCreateCycle(id, depId).pipe(
          Effect.flatMap((cycle) =>
            cycle
              ? Effect.fail(
                  new MemoryNodeError({
                    id,
                    message: `Adding edge to ${depId} would create a cycle`,
                  }),
                )
              : Effect.void,
          ),
        ),
      );
      const newDerived = [
        ...node.edges.derived_from,
        ...Arr.filter(derivedFromIds, (d) => !node.edges.derived_from.includes(d)),
      ];
      const updated: MemoryNode = {
        ...node,
        scale: scaleOrder[currentIdx + 1] ?? node.scale,
        edges: { derived_from: newDerived },
        session_count: 0,
        updated: yield* todayString,
      };
      return yield* writeNode(updated);
    });

    const prune = Effect.fn("MemoryStore.prune")(function* (thresholds: Record<string, number>) {
      const all = yield* listAll();
      const toPrune = Arr.filter(all, (n) => {
        if (n.state !== "ACTIVE") return false;
        const threshold = thresholds[n.type];
        return threshold !== undefined && n.session_count > threshold;
      });
      if (toPrune.length === 0) return [];
      const today = yield* todayString;
      const updated = Arr.map(
        toPrune,
        (node): MemoryNode => ({ ...node, state: "STALE", updated: today }),
      );
      const writes = yield* Effect.forEach(updated, (node) =>
        filePath(node.id, node.source).pipe(
          Effect.map((target) => ({ target, content: serializeNode(node) })),
        ),
      );
      yield* writeBatch(writes);
      return updated;
    });

    const status = Effect.fn("MemoryStore.status")(function* () {
      const all = yield* listAll();
      const empty: Record<string, number> = {};
      const { byState, byScale, byType, bySource } = all.reduce(
        (acc, node) => ({
          byState: increment(acc.byState, node.state),
          byScale: increment(acc.byScale, node.scale),
          byType: increment(acc.byType, node.type),
          bySource: increment(acc.bySource, node.source),
        }),
        { byState: empty, byScale: empty, byType: empty, bySource: empty },
      );
      return { total: all.length, byState, byScale, byType, bySource };
    });

    return { create, read, list, query, transition, promote, prune, status };
  });

const GroundConfigSchema = Schema.Struct({
  ground: Schema.Struct({
    stores: Schema.Array(
      Schema.Union([MemoryStoreEntry, Schema.Record(Schema.String, Schema.Unknown)]),
    ),
  }),
});

const resolveMemoryDirs = Effect.gen(function* () {
  const config = yield* Config;
  const raw = yield* config.readConfig.pipe(Effect.catch(() => Effect.succeed(null)));
  if (raw === null) return FALLBACK_MEMORY_DIRS;
  const parsed = Yaml.parse(raw);
  return Schema.decodeUnknownOption(GroundConfigSchema)(parsed).pipe(
    Option.map((c) =>
      c.ground.stores
        .filter((s): s is typeof MemoryStoreEntry.Type => s.kind === "Memory")
        .map((s): MemoryDir => ({ path: s.path, source: s.name })),
    ),
    Option.filter((dirs) => dirs.length > 0),
    Option.getOrElse(() => FALLBACK_MEMORY_DIRS),
  );
});

export class MemoryStore extends Context.Service<MemoryStore, MemoryStoreContract>()(
  "@anakmagang/MemoryStore",
) {
  static readonly layer = Layer.effect(
    MemoryStore,
    resolveMemoryDirs.pipe(
      Effect.flatMap((dirs) => makeStoreContract(dirs)),
      Effect.map((c) => MemoryStore.of(c)),
    ),
  ).pipe(Layer.provide(Config.layer));

  static readonly layerWithSearch = Layer.effect(
    MemoryStore,
    Effect.gen(function* () {
      const dirs = yield* resolveMemoryDirs;
      const search: SearchContract = yield* Search;
      const contract = yield* makeStoreContract(dirs, search);
      return MemoryStore.of(contract);
    }),
  ).pipe(Layer.provide(Config.layer), Layer.provide(Search.layer));

  static readonly layerFrom = (dirs: readonly MemoryDir[]) =>
    Layer.effect(MemoryStore, makeStoreContract(dirs).pipe(Effect.map((c) => MemoryStore.of(c))));
}
