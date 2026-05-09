import { Config, Context, Data, Effect, Layer, Schema } from "effect"
import { Path } from "effect/Path"
import {
  FFFError,
  openLib,
  buf,
  readResultIntValue,
  unwrapResult,
  unwrapResultVoid,
  unwrapResultBool,
  unwrapResultInt,
  unwrapResultString,
  validateLibrary,
  extractSearchResult,
  extractGrepResult,
  extractDirSearchResult,
  extractMixedSearchResult,
  extractScanProgress,
} from "./FFF"

export type {
  FileItem,
  Score,
  Location,
  MatchRange,
  SearchResult,
  GrepMatch,
  GrepResult,
  DirItem,
  DirSearchResult,
  MixedItem,
  MixedSearchResult,
  ScanProgress,
} from "./FFF"

export class SearchError extends Data.TaggedError("SearchError")<{
  readonly query: string
  readonly message: string
}> {}

export const FindOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
  pageSize: Schema.OptionFromOptional(Schema.Number),
  comboBoost: Schema.OptionFromOptional(Schema.Number),
  minCombo: Schema.OptionFromOptional(Schema.Number),
})
export type FindOptsEncoded = typeof FindOpts.Encoded

export const GrepOpts = Schema.Struct({
  mode: Schema.OptionFromOptional(Schema.Literals(["plain", "regex", "fuzzy"])),
  glob: Schema.OptionFromOptional(Schema.String),
  maxFileSize: Schema.OptionFromOptional(Schema.Number),
  maxPerFile: Schema.OptionFromOptional(Schema.Number),
  smartCase: Schema.OptionFromOptional(Schema.Boolean),
  offset: Schema.OptionFromOptional(Schema.Number),
  limit: Schema.OptionFromOptional(Schema.Number),
  timeBudget: Schema.OptionFromOptional(Schema.Number),
  before: Schema.OptionFromOptional(Schema.Number),
  after: Schema.OptionFromOptional(Schema.Number),
  definitions: Schema.OptionFromOptional(Schema.Boolean),
})
export type GrepOptsEncoded = typeof GrepOpts.Encoded

export const DirSearchOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
  pageSize: Schema.OptionFromOptional(Schema.Number),
})
export type DirSearchOptsEncoded = typeof DirSearchOpts.Encoded

export const MixedSearchOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
  pageSize: Schema.OptionFromOptional(Schema.Number),
  comboBoost: Schema.OptionFromOptional(Schema.Number),
  minCombo: Schema.OptionFromOptional(Schema.Number),
})
export type MixedSearchOptsEncoded = typeof MixedSearchOpts.Encoded

type SearchResult = import("./FFF").SearchResult
type GrepResult = import("./FFF").GrepResult
type DirSearchResult = import("./FFF").DirSearchResult
type MixedSearchResult = import("./FFF").MixedSearchResult
type ScanProgress = import("./FFF").ScanProgress

const toSearchError = (e: unknown, query: string): SearchError =>
  e instanceof FFFError
    ? new SearchError({ query: e.query, message: e.message })
    : new SearchError({ query, message: String(e) })

export interface SearchContract {
  readonly find: (query: string, opts?: FindOptsEncoded) => Effect.Effect<SearchResult, SearchError>
  readonly grep: (query: string, opts?: GrepOptsEncoded) => Effect.Effect<GrepResult, SearchError>
  readonly multiGrep: (patterns: ReadonlyArray<string>, opts?: GrepOptsEncoded) => Effect.Effect<GrepResult, SearchError>
  readonly findDirectories: (query: string, opts?: DirSearchOptsEncoded) => Effect.Effect<DirSearchResult, SearchError>
  readonly findMixed: (query: string, opts?: MixedSearchOptsEncoded) => Effect.Effect<MixedSearchResult, SearchError>
  readonly scanFiles: () => Effect.Effect<void, SearchError>
  readonly isScanning: () => Effect.Effect<boolean>
  readonly getBasePath: () => Effect.Effect<string | null, SearchError>
  readonly getScanProgress: () => Effect.Effect<ScanProgress, SearchError>
  readonly waitForWatcher: (timeoutMs?: number) => Effect.Effect<boolean, SearchError>
  readonly reindex: (newPath: string) => Effect.Effect<void, SearchError>
  readonly refreshGitStatus: () => Effect.Effect<number, SearchError>
  readonly trackQuery: (query: string, filePath: string) => Effect.Effect<boolean, SearchError>
  readonly getHistoricalQuery: (offset: number) => Effect.Effect<string | null, SearchError>
  readonly healthCheck: (testPath?: string) => Effect.Effect<unknown, SearchError>
}

export class Search extends Context.Service<Search, SearchContract>()("@anakmagang/Search") {
  static readonly layer = Layer.effect(
    Search,
    Effect.gen(function* () {
      const libDir = yield* Config.string("LIBFFF_PATH").pipe(Config.withDefault(""))
      const libPath = libDir ? `${libDir}/libfff_c.dylib` : "libfff_c.dylib"
      const lib = openLib(libPath)
      const path = yield* Path
      const cwd = path.resolve(".")

      const createResultPtr = lib.symbols.fff_create_instance2(
        buf(cwd), null, null,
        false, false, true, false, true,
        null, null,
        0n, 0n, 0n,
      )

      const handle = yield* Effect.try({
        try: () => unwrapResult(lib, createResultPtr, "<init>"),
        catch: (e) => {
          lib.close()
          return toSearchError(e, "<init>")
        },
      })

      yield* Effect.try({
        try: () => validateLibrary(lib, handle),
        catch: (e) => toSearchError(e, "<validate>"),
      })

      const waitForScan = (timeoutMs: bigint): boolean => {
        const waitResultPtr = lib.symbols.fff_wait_for_scan(handle, timeoutMs)
        if (!waitResultPtr) return false
        const done = readResultIntValue(waitResultPtr)
        lib.symbols.fff_free_result(waitResultPtr)
        return done !== 0n
      }

      const scanReady = waitForScan(5000n)
      if (!scanReady) {
        yield* Effect.logWarning("Search scan incomplete after 5s — proceeding with partial index")
        const retryReady = waitForScan(25000n)
        if (!retryReady) {
          yield* Effect.logWarning("Search scan incomplete after 30s — operations may return partial results")
        }
      }

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          lib.symbols.fff_destroy(handle)
          lib.close()
        })
      )

      return {
        find: Effect.fn("Search.find")(function* (query: string, opts?: FindOptsEncoded) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_search(
                handle, buf(query),
                opts?.currentFile ? buf(opts.currentFile) : null,
                opts?.threads ?? 0,
                opts?.page ?? 0,
                opts?.pageSize ?? 100,
                opts?.comboBoost ?? 0,
                opts?.minCombo ?? 0,
              )
              const searchResultPtr = unwrapResult(lib, resultPtr, query)
              const result = extractSearchResult(lib, searchResultPtr)
              lib.symbols.fff_free_search_result(searchResultPtr)
              return result
            },
            catch: (e) => toSearchError(e, query),
          })
        }),

        grep: Effect.fn("Search.grep")(function* (query: string, opts?: GrepOptsEncoded) {
          return yield* Effect.try({
            try: () => {
              const modeMap = { plain: 0, regex: 1, fuzzy: 2 } as const
              const mode = modeMap[opts?.mode ?? "plain"]
              const fullQuery = opts?.glob ? `${opts.glob} ${query}` : query

              const resultPtr = lib.symbols.fff_live_grep(
                handle, buf(fullQuery),
                mode,
                BigInt(opts?.maxFileSize ?? 0),
                opts?.maxPerFile ?? 0,
                opts?.smartCase ?? true,
                opts?.offset ?? 0,
                opts?.limit ?? 50,
                BigInt(opts?.timeBudget ?? 0),
                opts?.before ?? 0,
                opts?.after ?? 0,
                opts?.definitions ?? false,
              )
              const grepResultPtr = unwrapResult(lib, resultPtr, query)
              const result = extractGrepResult(lib, grepResultPtr)
              lib.symbols.fff_free_grep_result(grepResultPtr)
              return result
            },
            catch: (e) => toSearchError(e, query),
          })
        }),

        multiGrep: Effect.fn("Search.multiGrep")(function* (patterns: ReadonlyArray<string>, opts?: GrepOptsEncoded) {
          const queryDesc = patterns.join(", ")
          return yield* Effect.try({
            try: () => {
              const joined = patterns.join("\n")
              const constraints = opts?.glob ? buf(opts.glob) : null

              const resultPtr = lib.symbols.fff_multi_grep(
                handle, buf(joined), constraints,
                BigInt(opts?.maxFileSize ?? 0),
                opts?.maxPerFile ?? 0,
                opts?.smartCase ?? true,
                opts?.offset ?? 0,
                opts?.limit ?? 50,
                BigInt(opts?.timeBudget ?? 0),
                opts?.before ?? 0,
                opts?.after ?? 0,
                opts?.definitions ?? false,
              )
              const grepResultPtr = unwrapResult(lib, resultPtr, queryDesc)
              const result = extractGrepResult(lib, grepResultPtr)
              lib.symbols.fff_free_grep_result(grepResultPtr)
              return result
            },
            catch: (e) => toSearchError(e, queryDesc),
          })
        }),

        findDirectories: Effect.fn("Search.findDirectories")(function* (query: string, opts?: DirSearchOptsEncoded) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_search_directories(
                handle, buf(query),
                opts?.currentFile ? buf(opts.currentFile) : null,
                opts?.threads ?? 0,
                opts?.page ?? 0,
                opts?.pageSize ?? 100,
              )
              const dsrPtr = unwrapResult(lib, resultPtr, query)
              const result = extractDirSearchResult(lib, dsrPtr)
              lib.symbols.fff_free_dir_search_result(dsrPtr)
              return result
            },
            catch: (e) => toSearchError(e, query),
          })
        }),

        findMixed: Effect.fn("Search.findMixed")(function* (query: string, opts?: MixedSearchOptsEncoded) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_search_mixed(
                handle, buf(query),
                opts?.currentFile ? buf(opts.currentFile) : null,
                opts?.threads ?? 0,
                opts?.page ?? 0,
                opts?.pageSize ?? 100,
                opts?.comboBoost ?? 0,
                opts?.minCombo ?? 0,
              )
              const msrPtr = unwrapResult(lib, resultPtr, query)
              const result = extractMixedSearchResult(lib, msrPtr)
              lib.symbols.fff_free_mixed_search_result(msrPtr)
              return result
            },
            catch: (e) => toSearchError(e, query),
          })
        }),

        scanFiles: Effect.fn("Search.scanFiles")(function* () {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_scan_files(handle)
              unwrapResultVoid(lib, resultPtr, "<scanFiles>")
            },
            catch: (e) => toSearchError(e, "<scanFiles>"),
          })
        }),

        isScanning: Effect.fn("Search.isScanning")(function* () {
          return lib.symbols.fff_is_scanning(handle)
        }),

        getBasePath: Effect.fn("Search.getBasePath")(function* () {
          return yield* Effect.try({
            try: () => unwrapResultString(lib, lib.symbols.fff_get_base_path(handle), "<getBasePath>"),
            catch: (e) => toSearchError(e, "<getBasePath>"),
          })
        }),

        getScanProgress: Effect.fn("Search.getScanProgress")(function* () {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_get_scan_progress(handle)
              const spPtr = unwrapResult(lib, resultPtr, "<getScanProgress>")
              const progress = extractScanProgress(spPtr)
              lib.symbols.fff_free_scan_progress(spPtr)
              return progress
            },
            catch: (e) => toSearchError(e, "<getScanProgress>"),
          })
        }),

        waitForWatcher: Effect.fn("Search.waitForWatcher")(function* (timeoutMs?: number) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_wait_for_watcher(handle, BigInt(timeoutMs ?? 30000))
              return unwrapResultBool(lib, resultPtr, "<waitForWatcher>")
            },
            catch: (e) => toSearchError(e, "<waitForWatcher>"),
          })
        }),

        reindex: Effect.fn("Search.reindex")(function* (newPath: string) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_restart_index(handle, buf(newPath))
              unwrapResultVoid(lib, resultPtr, "<reindex>")
            },
            catch: (e) => toSearchError(e, "<reindex>"),
          })
        }),

        refreshGitStatus: Effect.fn("Search.refreshGitStatus")(function* () {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_refresh_git_status(handle)
              return unwrapResultInt(lib, resultPtr, "<refreshGitStatus>")
            },
            catch: (e) => toSearchError(e, "<refreshGitStatus>"),
          })
        }),

        trackQuery: Effect.fn("Search.trackQuery")(function* (query: string, filePath: string) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_track_query(handle, buf(query), buf(filePath))
              return unwrapResultBool(lib, resultPtr, "<trackQuery>")
            },
            catch: (e) => toSearchError(e, "<trackQuery>"),
          })
        }),

        getHistoricalQuery: Effect.fn("Search.getHistoricalQuery")(function* (offset: number) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_get_historical_query(handle, BigInt(offset))
              return unwrapResultString(lib, resultPtr, "<getHistoricalQuery>")
            },
            catch: (e) => toSearchError(e, "<getHistoricalQuery>"),
          })
        }),

        healthCheck: Effect.fn("Search.healthCheck")(function* (testPath?: string) {
          return yield* Effect.try({
            try: () => {
              const resultPtr = lib.symbols.fff_health_check(handle, testPath ? buf(testPath) : null)
              const jsonStr = unwrapResultString(lib, resultPtr, "<healthCheck>")
              return jsonStr ? JSON.parse(jsonStr) : null
            },
            catch: (e) => toSearchError(e, "<healthCheck>"),
          })
        }),
      }
    })
  )
}
