import { Context, Effect, Layer } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { Config } from "./Config"
import { Search, type SearchContract } from "./Search"
import type { GrepResult } from "./FFF"
import * as Yaml from "./Yaml"
export * from "./MemoryParser"
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
} from "./MemoryParser"

export interface MemoryDir {
  readonly path: string
  readonly source: string
}

export const DEFAULT_DIRS: readonly MemoryDir[] = [
  { path: ".claude/memories", source: "permanent" },
]

export interface MemoryStoreContract {
  readonly create: (input: MemoryNodeInput) => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly read: (id: string) => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly list: (filter?: MemoryFilter) => Effect.Effect<readonly MemoryNode[]>
  readonly query: (keywords: readonly string[], filter?: MemoryFilter) => Effect.Effect<readonly MemoryNode[]>
  readonly transition: (id: string, to: "ACTIVE" | "STALE" | "ARCHIVED") => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly promote: (id: string, derivedFromIds: readonly string[]) => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly prune: (thresholds: Record<string, number>) => Effect.Effect<readonly MemoryNode[]>
  readonly status: () => Effect.Effect<MemoryStatus>
}

export const makeStoreContract = (dirs: readonly MemoryDir[], search?: SearchContract): Effect.Effect<MemoryStoreContract, never, FileSystem | Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem
    const p = yield* Path

    const resolvedDirs = dirs.map(d => ({ ...d, resolved: p.resolve(d.path) }))

    for (const d of resolvedDirs) {
      yield* fs.makeDirectory(d.resolved, { recursive: true }).pipe(Effect.orDie)
    }

    const dirForSource = (source: string): string => {
      const found = resolvedDirs.find(d => d.source === source)
      if (!found) throw new Error(`Unknown memory source: ${source}. Valid sources: ${resolvedDirs.map(d => d.source).join(", ")}`)
      return found.resolved
    }

    const filePath = (id: string, source: string): string => p.join(dirForSource(source), `${id}.md`)

    const writeAtomic = Effect.fn("MemoryStore.writeAtomic")(function* (target: string, content: string) {
      const tmp = `${target}.tmp`
      yield* fs.writeFileString(tmp, content).pipe(
        Effect.mapError(() => new MemoryNodeError({ id: target, message: `Failed to write temp file: ${tmp}` }))
      )
      yield* fs.rename(tmp, target).pipe(
        Effect.mapError(() => new MemoryNodeError({ id: target, message: `Failed to rename: ${tmp} -> ${target}` }))
      )
    })

    const writeBatch = Effect.fn("MemoryStore.writeBatch")(function* (writes: ReadonlyArray<{ target: string; content: string }>) {
      const temps = yield* Effect.forEach(writes, ({ target, content }) => {
        const tmp = `${target}.tmp`
        return fs.writeFileString(tmp, content).pipe(
          Effect.as(tmp),
          Effect.mapError(() => new MemoryNodeError({ id: target, message: `Batch write failed at temp: ${tmp}` }))
        )
      })
      yield* Effect.forEach(writes, ({ target }, i) =>
        fs.rename(temps[i], target).pipe(
          Effect.mapError(() => new MemoryNodeError({ id: target, message: `Batch rename failed: ${temps[i]} -> ${target}` }))
        )
      )
    })

    const findNodeFile = Effect.fn("MemoryStore.findNodeFile")(function* (id: string) {
      for (const d of resolvedDirs) {
        const fp = p.join(d.resolved, `${id}.md`)
        const exists = yield* fs.exists(fp).pipe(Effect.orDie)
        if (exists) return fp
      }
      return yield* new MemoryNodeError({ id, message: `Memory node not found: ${id}` })
    })

    const readNode = Effect.fn("MemoryStore.readNode")(function* (id: string) {
      const fp = yield* findNodeFile(id)
      const content = yield* fs.readFileString(fp).pipe(
        Effect.mapError(() => new MemoryNodeError({ id, message: `Memory node not found: ${id}` }))
      )
      return yield* parseMemoryFrontmatter(content, id)
    })

    const writeNode = Effect.fn("MemoryStore.writeNode")(function* (node: MemoryNode) {
      yield* writeAtomic(filePath(node.id, node.source), serializeNode(node))
      return node
    })

    const listAll = Effect.fn("MemoryStore.listAll")(function* () {
      const allNodes: MemoryNode[] = []
      for (const d of resolvedDirs) {
        const dirExists = yield* fs.exists(d.resolved).pipe(Effect.orDie)
        if (!dirExists) continue
        const entries = yield* fs.readDirectory(d.resolved).pipe(Effect.orDie)
        const mdFiles = entries.filter((e) => e.endsWith(".md"))
        const results = yield* Effect.forEach(
          mdFiles,
          (file) => {
            const id = file.replace(/\.md$/, "")
            const fp = p.join(d.resolved, file)
            return fs.readFileString(fp).pipe(
              Effect.flatMap((content) => parseMemoryFrontmatter(content, id)),
              Effect.catch(() => Effect.succeed(null)),
            )
          },
          { concurrency: "unbounded" },
        )
        allNodes.push(...results.filter((n): n is MemoryNode => n !== null))
      }
      return allNodes
    })

    return {
      create: Effect.fn("MemoryStore.create")(function* (input: MemoryNodeInput) {
        const id = toId(input.name)
        if (id === "") {
          return yield* new MemoryNodeError({ id: "", message: "Cannot generate id from name" })
        }
        for (const d of resolvedDirs) {
          const fp = p.join(d.resolved, `${id}.md`)
          const exists = yield* fs.exists(fp).pipe(Effect.orDie)
          if (exists) {
            return yield* new MemoryNodeError({ id, message: `Memory node already exists: ${id}` })
          }
        }
        const node: MemoryNode = {
          id,
          name: input.name,
          description: input.description,
          type: input.type,
          scale: input.scale ?? "observation",
          state: "ACTIVE",
          updated: todayString(),
          session_count: 0,
          edges: { derived_from: [] },
          tags: input.tags ? [...input.tags] : [],
          body: input.body ?? "",
          source: input.source ?? "permanent",
        }
        return yield* writeNode(node)
      }),

      read: readNode,

      list: Effect.fn("MemoryStore.list")(function* (filter?: MemoryFilter) {
        const all = yield* listAll()
        if (filter === undefined) return all
        return all.filter((n) => matchesFilter(n, filter))
      }),

      query: Effect.fn("MemoryStore.query")(function* (keywords: readonly string[], filter?: MemoryFilter) {
        if (keywords.length === 0) {
          const all = yield* listAll()
          return filter ? all.filter((n) => matchesFilter(n, filter)) : all
        }

        if (!search) {
          const all = yield* listAll()
          const lowerKeywords = keywords.map((k) => k.toLowerCase())
          const matched = all.filter((n) => {
            const text = `${n.name} ${n.description} ${n.body}`.toLowerCase()
            return lowerKeywords.some((kw) => text.includes(kw))
          })
          return filter ? matched.filter((n) => matchesFilter(n, filter)) : matched
        }

        const globPaths = resolvedDirs.map(
          (d) => p.relative(p.resolve("."), d.resolved) + "/*.md"
        )

        const allNodes: MemoryNode[] = []
        for (const globPath of globPaths) {
          const grepResult = yield* search.multiGrep([...keywords], { glob: globPath, limit: 50 }).pipe(
            Effect.catch(() => Effect.succeed({ items: [], totalMatched: 0, totalFilesSearched: 0, totalFiles: 0, filteredFileCount: 0, nextFileOffset: 0, regexFallbackError: null } satisfies GrepResult))
          )
          if (grepResult.items.length === 0) continue

          const uniquePaths = [...new Set(grepResult.items.map((item) => item.path))]
          const nodes = yield* Effect.forEach(
            uniquePaths,
            (matchedPath) => {
              const id = p.basename(matchedPath).replace(/\.md$/, "")
              return fs.readFileString(matchedPath).pipe(
                Effect.flatMap((content) => parseMemoryFrontmatter(content, id)),
                Effect.catch(() => Effect.succeed(null)),
              )
            },
            { concurrency: "unbounded" },
          )
          allNodes.push(...nodes.filter((n): n is MemoryNode => n !== null))
        }

        return filter ? allNodes.filter((n) => matchesFilter(n, filter)) : allNodes
      }),

      transition: Effect.fn("MemoryStore.transition")(function* (id: string, to: "ACTIVE" | "STALE" | "ARCHIVED") {
        const node = yield* readNode(id)
        const updated: MemoryNode = { ...node, state: to, updated: todayString() }
        return yield* writeNode(updated).pipe(Effect.orDie)
      }),

      promote: Effect.fn("MemoryStore.promote")(function* (id: string, derivedFromIds: readonly string[]) {
        const node = yield* readNode(id)
        if (node.state !== "ACTIVE") {
          return yield* new MemoryNodeError({ id, message: `Cannot promote non-ACTIVE node (state: ${node.state})` })
        }
        const currentIdx = scaleOrder.indexOf(node.scale)
        if (currentIdx === -1 || currentIdx >= scaleOrder.length - 1) {
          return yield* new MemoryNodeError({ id, message: `Cannot promote beyond principle (current: ${node.scale})` })
        }
        for (const depId of derivedFromIds) {
          if (depId === id) {
            return yield* new MemoryNodeError({ id, message: "Self-referencing edge not allowed" })
          }
          const depFile = yield* findNodeFile(depId).pipe(
            Effect.catch(() => Effect.succeed(null))
          )
          if (depFile === null) {
            return yield* new MemoryNodeError({ id, message: `Derived-from node not found: ${depId}` })
          }
        }
        const newDerived = [
          ...node.edges.derived_from,
          ...derivedFromIds.filter((d) => !node.edges.derived_from.includes(d)),
        ]
        const updated: MemoryNode = {
          ...node,
          scale: scaleOrder[currentIdx + 1]!,
          edges: { derived_from: newDerived },
          session_count: 0,
          updated: todayString(),
        }
        return yield* writeNode(updated).pipe(Effect.orDie)
      }),

      prune: Effect.fn("MemoryStore.prune")(function* (thresholds: Record<string, number>) {
        const all = yield* listAll()
        const toPrune = all.filter((n) => {
          if (n.state !== "ACTIVE") return false
          const threshold = thresholds[n.type]
          return threshold !== undefined && n.session_count > threshold
        })
        if (toPrune.length === 0) return []
        const updated = toPrune.map((node): MemoryNode => ({ ...node, state: "STALE", updated: todayString() }))
        yield* writeBatch(
          updated.map((node) => ({ target: filePath(node.id, node.source), content: serializeNode(node) }))
        ).pipe(Effect.orDie)
        return updated
      }),

      status: Effect.fn("MemoryStore.status")(function* () {
        const all = yield* listAll()
        const { byState, byScale, byType, bySource } = all.reduce(
          (acc, node) => ({
            byState: increment(acc.byState, node.state),
            byScale: increment(acc.byScale, node.scale),
            byType: increment(acc.byType, node.type),
            bySource: increment(acc.bySource, node.source),
          }),
          {
            byState: {} as Record<string, number>,
            byScale: {} as Record<string, number>,
            byType: {} as Record<string, number>,
            bySource: {} as Record<string, number>,
          },
        )
        return { total: all.length, byState, byScale, byType, bySource }
      }),
    }
  })

const resolveMemoryDirs: Effect.Effect<readonly MemoryDir[], never, Config> =
  Effect.gen(function* () {
    const config = yield* Config
    const raw = yield* config.readConfig.pipe(Effect.catch(() => Effect.succeed(null)))
    if (raw === null) return DEFAULT_DIRS
    const parsed = Yaml.parse(raw)
    if (parsed === null || typeof parsed !== "object") return DEFAULT_DIRS
    const isRecord = (v: unknown): v is Record<string, unknown> =>
      v !== null && typeof v === "object"
    const isMemoryDirLike = (d: unknown): d is { path: string; source: string } =>
      isRecord(d) && typeof d.path === "string" && typeof d.source === "string"
    if (!isRecord(parsed)) return DEFAULT_DIRS
    const memory = parsed.memory
    if (!isRecord(memory)) return DEFAULT_DIRS
    const memDirs = memory.dirs
    if (!Array.isArray(memDirs)) return DEFAULT_DIRS
    const dirs = memDirs
      .filter(isMemoryDirLike)
      .map((d): MemoryDir => ({ path: d.path, source: d.source }))
    return dirs.length > 0 ? dirs : DEFAULT_DIRS
  })

export class MemoryStore extends Context.Service<MemoryStore, MemoryStoreContract>()("@anakmagang/MemoryStore") {
  static readonly layer = Layer.effect(
    MemoryStore,
    resolveMemoryDirs.pipe(Effect.flatMap((dirs) => makeStoreContract(dirs)))
  ).pipe(Layer.provide(Config.layer))

  static readonly layerWithSearch = Layer.effect(
    MemoryStore,
    Effect.gen(function* () {
      const dirs = yield* resolveMemoryDirs
      const search: SearchContract = yield* Search
      return yield* makeStoreContract(dirs, search)
    })
  ).pipe(Layer.provide(Config.layer), Layer.provide(Search.layer))

  static readonly layerFrom = (dirs: readonly MemoryDir[]) => Layer.effect(
    MemoryStore,
    makeStoreContract(dirs)
  )
}