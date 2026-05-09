import { type Pointer, dlopen, FFIType, CString, read } from "bun:ffi"

export class FFFError extends Error {
  readonly query: string
  constructor(opts: { query: string; message: string }) {
    super(opts.message)
    this.query = opts.query
    this.name = "FFFError"
  }
}

export interface FileItem {
  readonly path: string
  readonly fileName: string
  readonly gitStatus: string
  readonly size: number
  readonly modified: number
  readonly accessFrecencyScore: number
  readonly modificationFrecencyScore: number
  readonly totalFrecencyScore: number
  readonly isBinary: boolean
}

export interface Score {
  readonly total: number
  readonly baseScore: number
  readonly filenameBonus: number
  readonly specialFilenameBonus: number
  readonly frecencyBoost: number
  readonly distancePenalty: number
  readonly currentFilePenalty: number
  readonly comboMatchBoost: number
  readonly exactMatch: boolean
  readonly matchType: string
}

export interface Location {
  readonly tag: number
  readonly line: number
  readonly col: number
  readonly endLine: number
  readonly endCol: number
}

export interface MatchRange {
  readonly start: number
  readonly end: number
}

export interface SearchResult {
  readonly items: ReadonlyArray<FileItem>
  readonly scores: ReadonlyArray<Score>
  readonly totalMatched: number
  readonly totalFiles: number
  readonly location: Location
}

export interface GrepMatch {
  readonly path: string
  readonly fileName: string
  readonly gitStatus: string
  readonly lineContent: string
  readonly lineNumber: number
  readonly col: number
  readonly byteOffset: number
  readonly size: number
  readonly modified: number
  readonly totalFrecencyScore: number
  readonly accessFrecencyScore: number
  readonly modificationFrecencyScore: number
  readonly isBinary: boolean
  readonly isDefinition: boolean
  readonly matchRanges: ReadonlyArray<MatchRange>
  readonly contextBefore: ReadonlyArray<string>
  readonly contextAfter: ReadonlyArray<string>
  readonly fuzzyScore: number | null
}

export interface GrepResult {
  readonly items: ReadonlyArray<GrepMatch>
  readonly totalMatched: number
  readonly totalFilesSearched: number
  readonly totalFiles: number
  readonly filteredFileCount: number
  readonly nextFileOffset: number
  readonly regexFallbackError: string | null
}

export interface DirItem {
  readonly path: string
  readonly dirName: string
  readonly maxAccessFrecency: number
}

export interface DirSearchResult {
  readonly items: ReadonlyArray<DirItem>
  readonly scores: ReadonlyArray<Score>
  readonly totalMatched: number
  readonly totalDirs: number
}

export interface MixedItem {
  readonly type: "file" | "directory"
  readonly path: string
  readonly displayName: string
  readonly gitStatus: string
  readonly size: number
  readonly modified: number
  readonly accessFrecencyScore: number
  readonly modificationFrecencyScore: number
  readonly totalFrecencyScore: number
  readonly isBinary: boolean
}

export interface MixedSearchResult {
  readonly items: ReadonlyArray<MixedItem>
  readonly scores: ReadonlyArray<Score>
  readonly totalMatched: number
  readonly totalFiles: number
  readonly totalDirs: number
  readonly location: Location
}

export interface ScanProgress {
  readonly scannedFilesCount: number
  readonly isScanning: boolean
  readonly isWatcherReady: boolean
  readonly isWarmupComplete: boolean
}

const RESULT_SUCCESS_OFFSET = 0
const RESULT_ERROR_OFFSET = 8
const RESULT_HANDLE_OFFSET = 16
const RESULT_INT_VALUE_OFFSET = 24

const SC_TOTAL = 0
const SC_BASE = 4
const SC_FNAME = 8
const SC_SPECIAL = 12
const SC_FREC = 16
const SC_DIST = 20
const SC_CURFILE = 24
const SC_COMBO = 28
const SC_EXACT = 32
const SC_MTYPE = 40

const MR_START = 0
const MR_END = 4

const DI_RELPATH = 0
const DI_DIRNAME = 8
const DI_MAX_FRECENCY = 16

const MI_TYPE = 0
const MI_RELPATH = 8
const MI_DISPLAY = 16
const MI_GIT = 24
const MI_SIZE = 32
const MI_MODIFIED = 40
const MI_ACCESS = 48
const MI_MODFR = 56
const MI_TOTAL_FR = 64

const SR_MATCHED = 20
const SR_TOTAL = 24
const SR_LOC_TAG = 28

const DSR_MATCHED = 20
const DSR_TOTAL_DIRS = 24

const MSR_MATCHED = 20
const MSR_TOTAL_FILES = 24
const MSR_TOTAL_DIRS = 28
const MSR_LOC_TAG = 32

const SP_COUNT = 0
const SP_SCANNING = 8
const SP_WATCHER_READY = 9
const SP_WARMUP_COMPLETE = 10

const { ptr, cstring, u8, u16, u32, u64, i32, i64, bool, void: ffiVoid } = FFIType

export const openLib = (libPath: string) =>
  dlopen(libPath, {
    fff_create_instance2: {
      args: [cstring, cstring, cstring, bool, bool, bool, bool, bool, cstring, cstring, u64, u64, u64],
      returns: ptr,
    },
    fff_destroy: { args: [ptr], returns: ffiVoid },
    fff_free_result: { args: [ptr], returns: ffiVoid },
    fff_free_search_result: { args: [ptr], returns: ffiVoid },
    fff_free_grep_result: { args: [ptr], returns: ffiVoid },
    fff_free_dir_search_result: { args: [ptr], returns: ffiVoid },
    fff_free_mixed_search_result: { args: [ptr], returns: ffiVoid },
    fff_free_string: { args: [ptr], returns: ffiVoid },
    fff_free_scan_progress: { args: [ptr], returns: ffiVoid },

    fff_wait_for_scan: { args: [ptr, u64], returns: ptr },
    fff_scan_files: { args: [ptr], returns: ptr },
    fff_is_scanning: { args: [ptr], returns: bool },
    fff_get_base_path: { args: [ptr], returns: ptr },
    fff_get_scan_progress: { args: [ptr], returns: ptr },
    fff_wait_for_watcher: { args: [ptr, u64], returns: ptr },
    fff_restart_index: { args: [ptr, cstring], returns: ptr },
    fff_refresh_git_status: { args: [ptr], returns: ptr },
    fff_track_query: { args: [ptr, cstring, cstring], returns: ptr },
    fff_get_historical_query: { args: [ptr, u64], returns: ptr },
    fff_health_check: { args: [ptr, cstring], returns: ptr },

    fff_search: {
      args: [ptr, cstring, cstring, u32, u32, u32, i32, u32],
      returns: ptr,
    },
    fff_live_grep: {
      args: [ptr, cstring, u8, u64, u32, bool, u32, u32, u64, u32, u32, bool],
      returns: ptr,
    },
    fff_multi_grep: {
      args: [ptr, cstring, cstring, u64, u32, bool, u32, u32, u64, u32, u32, bool],
      returns: ptr,
    },
    fff_search_directories: {
      args: [ptr, cstring, cstring, u32, u32, u32],
      returns: ptr,
    },
    fff_search_mixed: {
      args: [ptr, cstring, cstring, u32, u32, u32, i32, u32],
      returns: ptr,
    },

    fff_search_result_get_count: { args: [ptr], returns: u32 },
    fff_search_result_get_item: { args: [ptr, u32], returns: ptr },
    fff_search_result_get_score: { args: [ptr, u32], returns: ptr },
    fff_search_result_get_total_matched: { args: [ptr], returns: u32 },
    fff_search_result_get_total_files: { args: [ptr], returns: u32 },

    fff_file_item_get_relative_path: { args: [ptr], returns: ptr },
    fff_file_item_get_file_name: { args: [ptr], returns: ptr },
    fff_file_item_get_git_status: { args: [ptr], returns: ptr },
    fff_file_item_get_size: { args: [ptr], returns: u64 },
    fff_file_item_get_modified: { args: [ptr], returns: u64 },
    fff_file_item_get_total_frecency_score: { args: [ptr], returns: i64 },
    fff_file_item_get_access_frecency_score: { args: [ptr], returns: i64 },
    fff_file_item_get_modification_frecency_score: { args: [ptr], returns: i64 },
    fff_file_item_get_is_binary: { args: [ptr], returns: bool },

    fff_grep_result_get_count: { args: [ptr], returns: u32 },
    fff_grep_result_get_match: { args: [ptr, u32], returns: ptr },
    fff_grep_result_get_total_matched: { args: [ptr], returns: u32 },
    fff_grep_result_get_total_files_searched: { args: [ptr], returns: u32 },
    fff_grep_result_get_total_files: { args: [ptr], returns: u32 },
    fff_grep_result_get_filtered_file_count: { args: [ptr], returns: u32 },
    fff_grep_result_get_next_file_offset: { args: [ptr], returns: u32 },
    fff_grep_result_get_regex_fallback_error: { args: [ptr], returns: ptr },

    fff_grep_match_get_relative_path: { args: [ptr], returns: ptr },
    fff_grep_match_get_file_name: { args: [ptr], returns: ptr },
    fff_grep_match_get_git_status: { args: [ptr], returns: ptr },
    fff_grep_match_get_line_number: { args: [ptr], returns: u64 },
    fff_grep_match_get_line_content: { args: [ptr], returns: ptr },
    fff_grep_match_get_col: { args: [ptr], returns: u32 },
    fff_grep_match_get_byte_offset: { args: [ptr], returns: u64 },
    fff_grep_match_get_size: { args: [ptr], returns: u64 },
    fff_grep_match_get_modified: { args: [ptr], returns: u64 },
    fff_grep_match_get_total_frecency_score: { args: [ptr], returns: i64 },
    fff_grep_match_get_access_frecency_score: { args: [ptr], returns: i64 },
    fff_grep_match_get_modification_frecency_score: { args: [ptr], returns: i64 },
    fff_grep_match_get_match_ranges_count: { args: [ptr], returns: u32 },
    fff_grep_match_get_match_range: { args: [ptr, u32], returns: ptr },
    fff_grep_match_get_context_before_count: { args: [ptr], returns: u32 },
    fff_grep_match_get_context_before: { args: [ptr, u32], returns: ptr },
    fff_grep_match_get_context_after_count: { args: [ptr], returns: u32 },
    fff_grep_match_get_context_after: { args: [ptr, u32], returns: ptr },
    fff_grep_match_get_fuzzy_score: { args: [ptr], returns: u16 },
    fff_grep_match_get_has_fuzzy_score: { args: [ptr], returns: bool },
    fff_grep_match_get_is_definition: { args: [ptr], returns: bool },
    fff_grep_match_get_is_binary: { args: [ptr], returns: bool },

    fff_dir_search_result_get_item: { args: [ptr, u32], returns: ptr },
    fff_dir_search_result_get_score: { args: [ptr, u32], returns: ptr },

    fff_mixed_search_result_get_item: { args: [ptr, u32], returns: ptr },
    fff_mixed_search_result_get_score: { args: [ptr, u32], returns: ptr },
  })

export type FffLib = ReturnType<typeof openLib>

export const buf = (s: string) => Buffer.from(s + "\0")

function isPointer(n: unknown): n is Pointer {
  return typeof n === "number" && n !== 0
}

const toPointer = (n: number): Pointer => {
  if (isPointer(n)) return n
  throw new FFFError({ query: "<ffi>", message: "Invalid null pointer" })
}

export const assertPtr = (p: Pointer | null, context: string): Pointer => {
  if (!p) throw new FFFError({ query: context, message: `Null pointer in ${context}` })
  return p
}

const readFfiString = (rawPtr: Pointer | null): string => {
  if (!rawPtr) return ""
  return new CString(rawPtr).toString()
}

const readCString = (rawPtr: number | null): string => {
  if (!rawPtr) return ""
  return new CString(toPointer(rawPtr)).toString()
}

const readFfiBool = (val: boolean): boolean => val

const readResultSuccess = (resultPtr: Pointer): boolean =>
  read.u8(resultPtr, RESULT_SUCCESS_OFFSET) !== 0

const readResultError = (resultPtr: Pointer): string | null => {
  const errorRaw = read.ptr(resultPtr, RESULT_ERROR_OFFSET)
  return errorRaw ? new CString(toPointer(errorRaw)).toString() : null
}

const readResultHandle = (resultPtr: Pointer): Pointer =>
  toPointer(read.ptr(resultPtr, RESULT_HANDLE_OFFSET))

export const readResultIntValue = (resultPtr: Pointer): bigint =>
  read.i64(resultPtr, RESULT_INT_VALUE_OFFSET)

export const unwrapResult = (lib: FffLib, resultPtr: Pointer | null, query: string): Pointer => {
  if (!resultPtr) throw new FFFError({ query, message: "FFI returned null result" })
  if (!readResultSuccess(resultPtr)) {
    const error = readResultError(resultPtr) ?? "Unknown FFI error"
    lib.symbols.fff_free_result(resultPtr)
    throw new FFFError({ query, message: error })
  }
  const handle = readResultHandle(resultPtr)
  lib.symbols.fff_free_result(resultPtr)
  return handle
}

export const unwrapResultVoid = (lib: FffLib, resultPtr: Pointer | null, query: string): void => {
  if (!resultPtr) throw new FFFError({ query, message: "FFI returned null result" })
  if (!readResultSuccess(resultPtr)) {
    const error = readResultError(resultPtr) ?? "Unknown FFI error"
    lib.symbols.fff_free_result(resultPtr)
    throw new FFFError({ query, message: error })
  }
  lib.symbols.fff_free_result(resultPtr)
}

export const unwrapResultBool = (lib: FffLib, resultPtr: Pointer | null, query: string): boolean => {
  if (!resultPtr) throw new FFFError({ query, message: "FFI returned null result" })
  if (!readResultSuccess(resultPtr)) {
    const error = readResultError(resultPtr) ?? "Unknown FFI error"
    lib.symbols.fff_free_result(resultPtr)
    throw new FFFError({ query, message: error })
  }
  const val = readResultIntValue(resultPtr)
  lib.symbols.fff_free_result(resultPtr)
  return val !== 0n
}

export const unwrapResultInt = (lib: FffLib, resultPtr: Pointer | null, query: string): number => {
  if (!resultPtr) throw new FFFError({ query, message: "FFI returned null result" })
  if (!readResultSuccess(resultPtr)) {
    const error = readResultError(resultPtr) ?? "Unknown FFI error"
    lib.symbols.fff_free_result(resultPtr)
    throw new FFFError({ query, message: error })
  }
  const val = readResultIntValue(resultPtr)
  lib.symbols.fff_free_result(resultPtr)
  return Number(val)
}

export const unwrapResultString = (lib: FffLib, resultPtr: Pointer | null, query: string): string | null => {
  if (!resultPtr) throw new FFFError({ query, message: "FFI returned null result" })
  if (!readResultSuccess(resultPtr)) {
    const error = readResultError(resultPtr) ?? "Unknown FFI error"
    lib.symbols.fff_free_result(resultPtr)
    throw new FFFError({ query, message: error })
  }
  const handleRaw = read.ptr(resultPtr, RESULT_HANDLE_OFFSET)
  lib.symbols.fff_free_result(resultPtr)
  if (!handleRaw) return null
  const handle = toPointer(handleRaw)
  const str = new CString(handle).toString()
  lib.symbols.fff_free_string(handle)
  return str
}

export const validateLibrary = (lib: FffLib, handle: Pointer): void => {
  const resultPtr = lib.symbols.fff_health_check(handle, null)
  if (!resultPtr) throw new FFFError({ query: "<validate>", message: "Library health check returned null — incompatible version?" })
  if (!readResultSuccess(resultPtr)) {
    const error = readResultError(resultPtr) ?? "Unknown error"
    lib.symbols.fff_free_result(resultPtr)
    throw new FFFError({ query: "<validate>", message: `Library health check failed: ${error}` })
  }
  lib.symbols.fff_free_result(resultPtr)
}

export const extractScore = (scorePtr: Pointer): Score => {
  if (!scorePtr) return { total: 0, baseScore: 0, filenameBonus: 0, specialFilenameBonus: 0, frecencyBoost: 0, distancePenalty: 0, currentFilePenalty: 0, comboMatchBoost: 0, exactMatch: false, matchType: "" }
  return {
    total: read.i32(scorePtr, SC_TOTAL),
    baseScore: read.i32(scorePtr, SC_BASE),
    filenameBonus: read.i32(scorePtr, SC_FNAME),
    specialFilenameBonus: read.i32(scorePtr, SC_SPECIAL),
    frecencyBoost: read.i32(scorePtr, SC_FREC),
    distancePenalty: read.i32(scorePtr, SC_DIST),
    currentFilePenalty: read.i32(scorePtr, SC_CURFILE),
    comboMatchBoost: read.i32(scorePtr, SC_COMBO),
    exactMatch: read.u8(scorePtr, SC_EXACT) !== 0,
    matchType: readCString(read.ptr(scorePtr, SC_MTYPE)),
  }
}

export const extractLocation = (basePtr: Pointer, tagOffset: number): Location => {
  if (!basePtr) return { tag: 0, line: 0, col: 0, endLine: 0, endCol: 0 }
  return {
    tag: read.u32(basePtr, tagOffset),
    line: read.u32(basePtr, tagOffset + 4),
    col: read.u32(basePtr, tagOffset + 8),
    endLine: read.u32(basePtr, tagOffset + 12),
    endCol: read.u32(basePtr, tagOffset + 16),
  }
}

export const extractFileItem = (lib: FffLib, itemPtr: Pointer): FileItem => ({
  path: readFfiString(lib.symbols.fff_file_item_get_relative_path(itemPtr)),
  fileName: readFfiString(lib.symbols.fff_file_item_get_file_name(itemPtr)),
  gitStatus: readFfiString(lib.symbols.fff_file_item_get_git_status(itemPtr)),
  size: Number(lib.symbols.fff_file_item_get_size(itemPtr)),
  modified: Number(lib.symbols.fff_file_item_get_modified(itemPtr)),
  accessFrecencyScore: Number(lib.symbols.fff_file_item_get_access_frecency_score(itemPtr)),
  modificationFrecencyScore: Number(lib.symbols.fff_file_item_get_modification_frecency_score(itemPtr)),
  totalFrecencyScore: Number(lib.symbols.fff_file_item_get_total_frecency_score(itemPtr)),
  isBinary: readFfiBool(lib.symbols.fff_file_item_get_is_binary(itemPtr)),
})

export const extractMatchRange = (rangePtr: Pointer): MatchRange => ({
  start: read.u32(rangePtr, MR_START),
  end: read.u32(rangePtr, MR_END),
})

export const extractGrepMatch = (lib: FffLib, matchPtr: Pointer): GrepMatch => {
  const matchRangesCount = lib.symbols.fff_grep_match_get_match_ranges_count(matchPtr)
  const matchRanges = Array.from({ length: matchRangesCount }, (_, i) =>
    lib.symbols.fff_grep_match_get_match_range(matchPtr, i)
  ).flatMap((rangePtr) => rangePtr ? [extractMatchRange(rangePtr)] : [])

  const contextBeforeCount = lib.symbols.fff_grep_match_get_context_before_count(matchPtr)
  const contextBefore = Array.from({ length: contextBeforeCount }, (_, i) =>
    readFfiString(lib.symbols.fff_grep_match_get_context_before(matchPtr, i))
  )

  const contextAfterCount = lib.symbols.fff_grep_match_get_context_after_count(matchPtr)
  const contextAfter = Array.from({ length: contextAfterCount }, (_, i) =>
    readFfiString(lib.symbols.fff_grep_match_get_context_after(matchPtr, i))
  )

  const hasFuzzy = readFfiBool(lib.symbols.fff_grep_match_get_has_fuzzy_score(matchPtr))
  const fuzzyScore = hasFuzzy ? Number(lib.symbols.fff_grep_match_get_fuzzy_score(matchPtr)) : null

  return {
    path: readFfiString(lib.symbols.fff_grep_match_get_relative_path(matchPtr)),
    fileName: readFfiString(lib.symbols.fff_grep_match_get_file_name(matchPtr)),
    gitStatus: readFfiString(lib.symbols.fff_grep_match_get_git_status(matchPtr)),
    lineContent: readFfiString(lib.symbols.fff_grep_match_get_line_content(matchPtr)),
    lineNumber: Number(lib.symbols.fff_grep_match_get_line_number(matchPtr)),
    col: lib.symbols.fff_grep_match_get_col(matchPtr),
    byteOffset: Number(lib.symbols.fff_grep_match_get_byte_offset(matchPtr)),
    size: Number(lib.symbols.fff_grep_match_get_size(matchPtr)),
    modified: Number(lib.symbols.fff_grep_match_get_modified(matchPtr)),
    totalFrecencyScore: Number(lib.symbols.fff_grep_match_get_total_frecency_score(matchPtr)),
    accessFrecencyScore: Number(lib.symbols.fff_grep_match_get_access_frecency_score(matchPtr)),
    modificationFrecencyScore: Number(lib.symbols.fff_grep_match_get_modification_frecency_score(matchPtr)),
    isBinary: readFfiBool(lib.symbols.fff_grep_match_get_is_binary(matchPtr)),
    isDefinition: readFfiBool(lib.symbols.fff_grep_match_get_is_definition(matchPtr)),
    matchRanges,
    contextBefore,
    contextAfter,
    fuzzyScore,
  }
}

export const extractSearchResult = (lib: FffLib, searchResultPtr: Pointer): SearchResult => {
  const count = lib.symbols.fff_search_result_get_count(searchResultPtr)
  const entries = Array.from({ length: count }, (_, i) => ({
    itemPtr: lib.symbols.fff_search_result_get_item(searchResultPtr, i),
    scorePtr: lib.symbols.fff_search_result_get_score(searchResultPtr, i),
  })).filter((e): e is { itemPtr: NonNullable<typeof e.itemPtr>; scorePtr: NonNullable<typeof e.scorePtr> } =>
    Boolean(e.itemPtr) && Boolean(e.scorePtr)
  )
  const items = entries.map(({ itemPtr }) => extractFileItem(lib, itemPtr))
  const scores = entries.map(({ scorePtr }) => extractScore(scorePtr))
  return {
    items,
    scores,
    totalMatched: read.u32(searchResultPtr, SR_MATCHED),
    totalFiles: read.u32(searchResultPtr, SR_TOTAL),
    location: extractLocation(searchResultPtr, SR_LOC_TAG),
  }
}

export const extractGrepResult = (lib: FffLib, grepResultPtr: Pointer): GrepResult => {
  const count = lib.symbols.fff_grep_result_get_count(grepResultPtr)
  const items = Array.from({ length: count }, (_, i) =>
    lib.symbols.fff_grep_result_get_match(grepResultPtr, i)
  ).flatMap((matchPtr) => matchPtr ? [extractGrepMatch(lib, matchPtr)] : [])

  const regexErrPtr = lib.symbols.fff_grep_result_get_regex_fallback_error(grepResultPtr)
  const regexFallbackError = readFfiString(regexErrPtr) || null

  return {
    items,
    totalMatched: lib.symbols.fff_grep_result_get_total_matched(grepResultPtr),
    totalFilesSearched: lib.symbols.fff_grep_result_get_total_files_searched(grepResultPtr),
    totalFiles: lib.symbols.fff_grep_result_get_total_files(grepResultPtr),
    filteredFileCount: lib.symbols.fff_grep_result_get_filtered_file_count(grepResultPtr),
    nextFileOffset: lib.symbols.fff_grep_result_get_next_file_offset(grepResultPtr),
    regexFallbackError,
  }
}

export const extractDirItem = (dirItemPtr: Pointer): DirItem => {
  if (!dirItemPtr) return { path: "", dirName: "", maxAccessFrecency: 0 }
  return {
    path: readCString(read.ptr(dirItemPtr, DI_RELPATH)),
    dirName: readCString(read.ptr(dirItemPtr, DI_DIRNAME)),
    maxAccessFrecency: Number(read.i64(dirItemPtr, DI_MAX_FRECENCY)),
  }
}

export const extractDirSearchResult = (lib: FffLib, dsrPtr: Pointer): DirSearchResult => {
  const count = read.u32(dsrPtr, 16)
  const entries = Array.from({ length: count }, (_, i) => ({
    itemPtr: lib.symbols.fff_dir_search_result_get_item(dsrPtr, i),
    scorePtr: lib.symbols.fff_dir_search_result_get_score(dsrPtr, i),
  })).filter((e): e is { itemPtr: NonNullable<typeof e.itemPtr>; scorePtr: NonNullable<typeof e.scorePtr> } =>
    Boolean(e.itemPtr) && Boolean(e.scorePtr)
  )
  const items = entries.map(({ itemPtr }) => extractDirItem(itemPtr))
  const scores = entries.map(({ scorePtr }) => extractScore(scorePtr))
  return {
    items,
    scores,
    totalMatched: read.u32(dsrPtr, DSR_MATCHED),
    totalDirs: read.u32(dsrPtr, DSR_TOTAL_DIRS),
  }
}

export const extractMixedItem = (mixedItemPtr: Pointer): MixedItem => {
  if (!mixedItemPtr) return { type: "file", path: "", displayName: "", gitStatus: "", size: 0, modified: 0, accessFrecencyScore: 0, modificationFrecencyScore: 0, totalFrecencyScore: 0, isBinary: false }
  const typeTag = read.u8(mixedItemPtr, MI_TYPE)
  return {
    type: typeTag === 0 ? "file" : "directory",
    path: readCString(read.ptr(mixedItemPtr, MI_RELPATH)),
    displayName: readCString(read.ptr(mixedItemPtr, MI_DISPLAY)),
    gitStatus: readCString(read.ptr(mixedItemPtr, MI_GIT)),
    size: Number(read.u64(mixedItemPtr, MI_SIZE)),
    modified: Number(read.i64(mixedItemPtr, MI_MODIFIED)),
    accessFrecencyScore: Number(read.i64(mixedItemPtr, MI_ACCESS)),
    modificationFrecencyScore: Number(read.i64(mixedItemPtr, MI_MODFR)),
    totalFrecencyScore: Number(read.i64(mixedItemPtr, MI_TOTAL_FR)),
    isBinary: false,
  }
}

export const extractMixedSearchResult = (lib: FffLib, msrPtr: Pointer): MixedSearchResult => {
  const count = read.u32(msrPtr, 16)
  const entries = Array.from({ length: count }, (_, i) => ({
    itemPtr: lib.symbols.fff_mixed_search_result_get_item(msrPtr, i),
    scorePtr: lib.symbols.fff_mixed_search_result_get_score(msrPtr, i),
  })).filter((e): e is { itemPtr: NonNullable<typeof e.itemPtr>; scorePtr: NonNullable<typeof e.scorePtr> } =>
    Boolean(e.itemPtr) && Boolean(e.scorePtr)
  )
  const items = entries.map(({ itemPtr }) => extractMixedItem(itemPtr))
  const scores = entries.map(({ scorePtr }) => extractScore(scorePtr))
  return {
    items,
    scores,
    totalMatched: read.u32(msrPtr, MSR_MATCHED),
    totalFiles: read.u32(msrPtr, MSR_TOTAL_FILES),
    totalDirs: read.u32(msrPtr, MSR_TOTAL_DIRS),
    location: extractLocation(msrPtr, MSR_LOC_TAG),
  }
}

export const extractScanProgress = (spPtr: Pointer): ScanProgress => {
  if (!spPtr) return { scannedFilesCount: 0, isScanning: false, isWatcherReady: false, isWarmupComplete: false }
  return {
    scannedFilesCount: Number(read.u64(spPtr, SP_COUNT)),
    isScanning: read.u8(spPtr, SP_SCANNING) !== 0,
    isWatcherReady: read.u8(spPtr, SP_WATCHER_READY) !== 0,
    isWarmupComplete: read.u8(spPtr, SP_WARMUP_COMPLETE) !== 0,
  }
}
