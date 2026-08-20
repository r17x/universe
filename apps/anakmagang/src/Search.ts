import { Config, Context, Effect, Layer, Schema } from "effect";
import { Path } from "effect/Path";
import compressedDylibPath from "../out/libfff_c.dylib.gz" with { type: "file" };
import {
  type FffLib,
  type SearchResult,
  type GrepResult,
  type DirSearchResult,
  type MixedSearchResult,
  type ScanProgress,
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
} from "./FFF";

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
} from "./FFF";

export class SearchError extends Schema.TaggedErrorClass<SearchError>()("SearchError", {
  query: Schema.String,
  message: Schema.String,
}) {}

export const FindOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
  pageSize: Schema.OptionFromOptional(Schema.Number),
  comboBoost: Schema.OptionFromOptional(Schema.Number),
  minCombo: Schema.OptionFromOptional(Schema.Number),
});
export type FindOptsEncoded = typeof FindOpts.Encoded;

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
});
export type GrepOptsEncoded = typeof GrepOpts.Encoded;

export const DirSearchOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
  pageSize: Schema.OptionFromOptional(Schema.Number),
});
export type DirSearchOptsEncoded = typeof DirSearchOpts.Encoded;

export const MixedSearchOpts = Schema.Struct({
  currentFile: Schema.OptionFromOptional(Schema.String),
  threads: Schema.OptionFromOptional(Schema.Number),
  page: Schema.OptionFromOptional(Schema.Number),
  pageSize: Schema.OptionFromOptional(Schema.Number),
  comboBoost: Schema.OptionFromOptional(Schema.Number),
  minCombo: Schema.OptionFromOptional(Schema.Number),
});
export type MixedSearchOptsEncoded = typeof MixedSearchOpts.Encoded;

const toSearchError = (e: unknown, query: string) =>
  e instanceof FFFError
    ? new SearchError({ query: e.query, message: e.message })
    : new SearchError({ query, message: String(e) });

const callFfi = <T>(query: string, f: () => T) =>
  Effect.try({
    try: f,
    catch: (e) => toSearchError(e, query),
  });

const unwrapAndExtract = <T>(
  lib: FffLib,
  resultPtr: ReturnType<FffLib["symbols"]["fff_search"]>,
  query: string,
  extract: (lib: FffLib, ptr: NonNullable<typeof resultPtr>) => T,
  free: (ptr: NonNullable<typeof resultPtr>) => void,
) =>
  callFfi(query, () => {
    const innerPtr = unwrapResult(lib, resultPtr, query);
    const result = extract(lib, innerPtr);
    free(innerPtr);
    return result;
  });

export interface SearchContract {
  readonly find: (
    query: string,
    opts?: FindOptsEncoded,
  ) => Effect.Effect<SearchResult, SearchError>;
  readonly grep: (query: string, opts?: GrepOptsEncoded) => Effect.Effect<GrepResult, SearchError>;
  readonly multiGrep: (
    patterns: ReadonlyArray<string>,
    opts?: GrepOptsEncoded,
  ) => Effect.Effect<GrepResult, SearchError>;
  readonly findDirectories: (
    query: string,
    opts?: DirSearchOptsEncoded,
  ) => Effect.Effect<DirSearchResult, SearchError>;
  readonly findMixed: (
    query: string,
    opts?: MixedSearchOptsEncoded,
  ) => Effect.Effect<MixedSearchResult, SearchError>;
  readonly scanFiles: () => Effect.Effect<void, SearchError>;
  readonly isScanning: () => Effect.Effect<boolean>;
  readonly getBasePath: () => Effect.Effect<string | null, SearchError>;
  readonly getScanProgress: () => Effect.Effect<ScanProgress, SearchError>;
  readonly waitForWatcher: (timeoutMs?: number) => Effect.Effect<boolean, SearchError>;
  readonly reindex: (newPath: string) => Effect.Effect<void, SearchError>;
  readonly refreshGitStatus: () => Effect.Effect<number, SearchError>;
  readonly trackQuery: (query: string, filePath: string) => Effect.Effect<boolean, SearchError>;
  readonly getHistoricalQuery: (offset: number) => Effect.Effect<string | null, SearchError>;
  readonly healthCheck: (testPath?: string) => Effect.Effect<unknown, SearchError>;
}

export class Search extends Context.Service<Search, SearchContract>()("@anakmagang/Search") {
  static readonly layer = Layer.effect(
    Search,
    Effect.gen(function* () {
      const libDir = yield* Config.string("LIBFFF_PATH").pipe(Config.withDefault(""));
      const logFilePath = yield* Config.string("FFF_LOG_PATH").pipe(Config.withDefault(""));
      const logLevel = yield* Config.string("FFF_LOG_LEVEL").pipe(Config.withDefault(""));
      const path = yield* Path;
      const cwd = path.resolve(".");

      const libPath = libDir
        ? path.join(libDir, "libfff_c.dylib")
        : path.join(Bun.env.TMPDIR ?? "/tmp", `libfff_c_${process.pid}.dylib`);
      if (!libDir) {
        const compressed = yield* Effect.promise(() => Bun.file(compressedDylibPath).bytes());
        const raw = Bun.gunzipSync(compressed);
        yield* Effect.promise(() => Bun.write(libPath, raw));
      }

      const lib = openLib(libPath);
      if (!libDir) yield* Effect.promise(() => Bun.file(libPath).delete());

      const createResultPtr = lib.symbols.fff_create_instance2(
        buf(cwd),
        null,
        null,
        false,
        false,
        true,
        false,
        true,
        logFilePath ? buf(logFilePath) : null,
        logLevel ? buf(logLevel) : null,
        0n,
        0n,
        0n,
      );

      const handle = yield* Effect.try({
        try: () => unwrapResult(lib, createResultPtr, "<init>"),
        catch: (e) => {
          lib.close();
          return toSearchError(e, "<init>");
        },
      });

      yield* Effect.try({
        try: () => validateLibrary(lib, handle),
        catch: (e) => toSearchError(e, "<validate>"),
      });

      const waitForScan = (timeoutMs: bigint) => {
        const waitResultPtr = lib.symbols.fff_wait_for_scan(handle, timeoutMs);
        if (!waitResultPtr) return false;
        const done = readResultIntValue(waitResultPtr);
        lib.symbols.fff_free_result(waitResultPtr);
        return done !== 0n;
      };

      const scanReady = waitForScan(5000n);
      if (!scanReady) {
        yield* Effect.logWarning("Search scan incomplete after 5s — proceeding with partial index");
        const retryReady = waitForScan(25000n);
        if (!retryReady) {
          yield* Effect.logWarning(
            "Search scan incomplete after 30s — operations may return partial results",
          );
        }
      }

      const find = Effect.fn("Search.find")(function* (query: string, opts?: FindOptsEncoded) {
        return yield* unwrapAndExtract(
          lib,
          lib.symbols.fff_search(
            handle,
            buf(query),
            opts?.currentFile ? buf(opts.currentFile) : null,
            opts?.threads ?? 0,
            opts?.page ?? 0,
            opts?.pageSize ?? 100,
            opts?.comboBoost ?? 0,
            opts?.minCombo ?? 0,
          ),
          query,
          extractSearchResult,
          (p) => lib.symbols.fff_free_search_result(p),
        );
      });

      const grep = Effect.fn("Search.grep")(function* (query: string, opts?: GrepOptsEncoded) {
        const modeMap = { plain: 0, regex: 1, fuzzy: 2 } as const;
        const mode = modeMap[opts?.mode ?? "plain"];
        const fullQuery = opts?.glob ? `${opts.glob} ${query}` : query;

        return yield* unwrapAndExtract(
          lib,
          lib.symbols.fff_live_grep(
            handle,
            buf(fullQuery),
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
          ),
          query,
          extractGrepResult,
          (p) => lib.symbols.fff_free_grep_result(p),
        );
      });

      const multiGrep = Effect.fn("Search.multiGrep")(function* (
        patterns: ReadonlyArray<string>,
        opts?: GrepOptsEncoded,
      ) {
        const queryDesc = patterns.join(", ");
        const joined = patterns.join("\n");
        const constraints = opts?.glob ? buf(opts.glob) : null;

        return yield* unwrapAndExtract(
          lib,
          lib.symbols.fff_multi_grep(
            handle,
            buf(joined),
            constraints,
            BigInt(opts?.maxFileSize ?? 0),
            opts?.maxPerFile ?? 0,
            opts?.smartCase ?? true,
            opts?.offset ?? 0,
            opts?.limit ?? 50,
            BigInt(opts?.timeBudget ?? 0),
            opts?.before ?? 0,
            opts?.after ?? 0,
            opts?.definitions ?? false,
          ),
          queryDesc,
          extractGrepResult,
          (p) => lib.symbols.fff_free_grep_result(p),
        );
      });

      const findDirectories = Effect.fn("Search.findDirectories")(function* (
        query: string,
        opts?: DirSearchOptsEncoded,
      ) {
        return yield* unwrapAndExtract(
          lib,
          lib.symbols.fff_search_directories(
            handle,
            buf(query),
            opts?.currentFile ? buf(opts.currentFile) : null,
            opts?.threads ?? 0,
            opts?.page ?? 0,
            opts?.pageSize ?? 100,
          ),
          query,
          extractDirSearchResult,
          (p) => lib.symbols.fff_free_dir_search_result(p),
        );
      });

      const findMixed = Effect.fn("Search.findMixed")(function* (
        query: string,
        opts?: MixedSearchOptsEncoded,
      ) {
        return yield* unwrapAndExtract(
          lib,
          lib.symbols.fff_search_mixed(
            handle,
            buf(query),
            opts?.currentFile ? buf(opts.currentFile) : null,
            opts?.threads ?? 0,
            opts?.page ?? 0,
            opts?.pageSize ?? 100,
            opts?.comboBoost ?? 0,
            opts?.minCombo ?? 0,
          ),
          query,
          extractMixedSearchResult,
          (p) => lib.symbols.fff_free_mixed_search_result(p),
        );
      });

      const scanFiles = Effect.fn("Search.scanFiles")(function* () {
        return yield* callFfi("<scanFiles>", () => {
          unwrapResultVoid(lib, lib.symbols.fff_scan_files(handle), "<scanFiles>");
        });
      });

      const isScanning = Effect.fn("Search.isScanning")(function* () {
        return lib.symbols.fff_is_scanning(handle);
      });

      const getBasePath = Effect.fn("Search.getBasePath")(function* () {
        return yield* callFfi("<getBasePath>", () =>
          unwrapResultString(lib, lib.symbols.fff_get_base_path(handle), "<getBasePath>"),
        );
      });

      const getScanProgress = Effect.fn("Search.getScanProgress")(function* () {
        return yield* callFfi("<getScanProgress>", () => {
          const resultPtr = lib.symbols.fff_get_scan_progress(handle);
          const spPtr = unwrapResult(lib, resultPtr, "<getScanProgress>");
          const progress = extractScanProgress(spPtr);
          lib.symbols.fff_free_scan_progress(spPtr);
          return progress;
        });
      });

      const waitForWatcher = Effect.fn("Search.waitForWatcher")(function* (timeoutMs?: number) {
        return yield* callFfi("<waitForWatcher>", () =>
          unwrapResultBool(
            lib,
            lib.symbols.fff_wait_for_watcher(handle, BigInt(timeoutMs ?? 30000)),
            "<waitForWatcher>",
          ),
        );
      });

      const reindex = Effect.fn("Search.reindex")(function* (newPath: string) {
        return yield* callFfi("<reindex>", () => {
          unwrapResultVoid(lib, lib.symbols.fff_restart_index(handle, buf(newPath)), "<reindex>");
        });
      });

      const refreshGitStatus = Effect.fn("Search.refreshGitStatus")(function* () {
        return yield* callFfi("<refreshGitStatus>", () =>
          unwrapResultInt(lib, lib.symbols.fff_refresh_git_status(handle), "<refreshGitStatus>"),
        );
      });

      const trackQuery = Effect.fn("Search.trackQuery")(function* (
        query: string,
        filePath: string,
      ) {
        return yield* callFfi("<trackQuery>", () =>
          unwrapResultBool(
            lib,
            lib.symbols.fff_track_query(handle, buf(query), buf(filePath)),
            "<trackQuery>",
          ),
        );
      });

      const getHistoricalQuery = Effect.fn("Search.getHistoricalQuery")(function* (offset: number) {
        return yield* callFfi("<getHistoricalQuery>", () =>
          unwrapResultString(
            lib,
            lib.symbols.fff_get_historical_query(handle, BigInt(offset)),
            "<getHistoricalQuery>",
          ),
        );
      });

      const healthCheck = Effect.fn("Search.healthCheck")(function* (testPath?: string) {
        return yield* callFfi("<healthCheck>", () => {
          const jsonStr = unwrapResultString(
            lib,
            lib.symbols.fff_health_check(handle, testPath ? buf(testPath) : null),
            "<healthCheck>",
          );
          return jsonStr
            ? Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(jsonStr)
            : null;
        });
      });

      return Search.of({
        find,
        grep,
        multiGrep,
        findDirectories,
        findMixed,
        scanFiles,
        isScanning,
        getBasePath,
        getScanProgress,
        waitForWatcher,
        reindex,
        refreshGitStatus,
        trackQuery,
        getHistoricalQuery,
        healthCheck,
      });
    }),
  );
}
