import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import type { Pointer } from "bun:ffi"
import {
  openLib,
  buf,
  unwrapResult,
  unwrapResultBool,
  unwrapResultString,
  extractSearchResult,
  extractGrepResult,
  extractDirSearchResult,
  extractMixedSearchResult,
  extractScanProgress,
  type FffLib,
  type SearchResult,
  type GrepResult,
  type DirSearchResult,
  type MixedSearchResult,
  type ScanProgress,
} from "./FFF"

const LIB_PATH = "/nix/store/d60rk6nv58mg233xp6ls3yzgh72wj8cs-libfff-c-0.6.4/lib/libfff_c.dylib"
const BASE_PATH = "/Users/r17/.config/nixpkgs"

let lib: FffLib
let handle: Pointer

beforeAll(() => {
  lib = openLib(LIB_PATH)
  const createPtr = lib.symbols.fff_create_instance2(
    buf(BASE_PATH),
    null,
    null,
    false,
    false,
    true,
    false,
    true,
    null,
    null,
    0n,
    0n,
    0n,
  )
  handle = unwrapResult(lib, createPtr, "<test-init>")
  const waitPtr = lib.symbols.fff_wait_for_scan(handle, 30000n)
  unwrapResultBool(lib, waitPtr, "<test-wait>")
})

afterAll(() => {
  if (handle && lib) {
    lib.symbols.fff_destroy(handle)
    lib.close()
  }
})

const doSearch = (query: string, pageSize = 100): SearchResult => {
  const resultPtr = lib.symbols.fff_search(
    handle,
    buf(query),
    null,
    0,
    0,
    pageSize,
    0,
    0,
  )
  const searchResultPtr = unwrapResult(lib, resultPtr, query)
  const result = extractSearchResult(lib, searchResultPtr)
  lib.symbols.fff_free_search_result(searchResultPtr)
  return result
}

const doGrep = (query: string, mode = 0, limit = 50): GrepResult => {
  const resultPtr = lib.symbols.fff_live_grep(
    handle,
    buf(query),
    mode,
    0n,
    0,
    true,
    0,
    limit,
    0n,
    0,
    0,
    false,
  )
  const grepResultPtr = unwrapResult(lib, resultPtr, query)
  const result = extractGrepResult(lib, grepResultPtr)
  lib.symbols.fff_free_grep_result(grepResultPtr)
  return result
}

const doMultiGrep = (patterns: ReadonlyArray<string>, limit = 50): GrepResult => {
  const joined = patterns.join("\n")
  const resultPtr = lib.symbols.fff_multi_grep(
    handle,
    buf(joined),
    null,
    0n,
    0,
    true,
    0,
    limit,
    0n,
    0,
    0,
    false,
  )
  const grepResultPtr = unwrapResult(lib, resultPtr, joined)
  const result = extractGrepResult(lib, grepResultPtr)
  lib.symbols.fff_free_grep_result(grepResultPtr)
  return result
}

const doDirSearch = (query: string, pageSize = 100): DirSearchResult => {
  const resultPtr = lib.symbols.fff_search_directories(
    handle,
    buf(query),
    null,
    0,
    0,
    pageSize,
  )
  const dsrPtr = unwrapResult(lib, resultPtr, query)
  const result = extractDirSearchResult(lib, dsrPtr)
  lib.symbols.fff_free_dir_search_result(dsrPtr)
  return result
}

const doMixedSearch = (query: string, pageSize = 100): MixedSearchResult => {
  const resultPtr = lib.symbols.fff_search_mixed(
    handle,
    buf(query),
    null,
    0,
    0,
    pageSize,
    0,
    0,
  )
  const msrPtr = unwrapResult(lib, resultPtr, query)
  const result = extractMixedSearchResult(lib, msrPtr)
  lib.symbols.fff_free_mixed_search_result(msrPtr)
  return result
}

const doGetScanProgress = (): ScanProgress => {
  const resultPtr = lib.symbols.fff_get_scan_progress(handle)
  const spPtr = unwrapResult(lib, resultPtr, "<getScanProgress>")
  const progress = extractScanProgress(spPtr)
  lib.symbols.fff_free_scan_progress(spPtr)
  return progress
}

const doHealthCheck = (testPath?: string): unknown => {
  const resultPtr = lib.symbols.fff_health_check(
    handle,
    testPath ? buf(testPath) : null,
  )
  const jsonStr = unwrapResultString(lib, resultPtr, "<healthCheck>")
  return jsonStr ? JSON.parse(jsonStr) : null
}

describe("FFF binding - file search", () => {
  test("search for 'flake.nix' returns at least 1 result with matching path", () => {
    const result = doSearch("flake.nix")
    expect(result.items.length).toBeGreaterThanOrEqual(1)
    const paths = result.items.map((i) => i.path)
    expect(paths.some((p) => p.includes("flake.nix"))).toBe(true)
  })

  test("first result for 'flake.nix' has a positive score", () => {
    const result = doSearch("flake.nix")
    expect(result.scores.length).toBeGreaterThanOrEqual(1)
    expect(result.scores[0].total).toBeGreaterThan(0)
  })

  test("search for 'Search.ts' returns a result containing Search.ts", () => {
    const result = doSearch("Search.ts")
    expect(result.items.length).toBeGreaterThanOrEqual(1)
    const paths = result.items.map((i) => i.path)
    expect(paths.some((p) => p.endsWith("Search.ts"))).toBe(true)
  })

  test("totalMatched reflects actual matches", () => {
    const result = doSearch("flake.nix")
    expect(result.totalMatched).toBeGreaterThanOrEqual(result.items.length)
  })

  test("totalFiles is greater than zero", () => {
    const result = doSearch("flake.nix")
    expect(result.totalFiles).toBeGreaterThan(0)
  })
})

describe("FFF binding - FileItem fields", () => {
  test("FileItem has non-empty path and fileName", () => {
    const result = doSearch("flake.nix")
    const item = result.items[0]
    expect(item.path.length).toBeGreaterThan(0)
    expect(item.fileName.length).toBeGreaterThan(0)
  })

  test("FileItem size is positive for known files", () => {
    const result = doSearch("flake.nix")
    const flakeItem = result.items.find((i) => i.path === "flake.nix")
    if (flakeItem) {
      expect(flakeItem.size).toBeGreaterThan(0)
    }
  })

  test("FileItem modified timestamp is positive", () => {
    const result = doSearch("flake.nix")
    const flakeItem = result.items.find((i) => i.path === "flake.nix")
    if (flakeItem) {
      expect(flakeItem.modified).toBeGreaterThan(0)
    }
  })

  test("FileItem isBinary is a boolean", () => {
    const result = doSearch("flake.nix")
    expect(typeof result.items[0].isBinary).toBe("boolean")
  })

  test("FileItem frecency scores are numbers", () => {
    const result = doSearch("flake.nix")
    const item = result.items[0]
    expect(typeof item.accessFrecencyScore).toBe("number")
    expect(typeof item.modificationFrecencyScore).toBe("number")
    expect(typeof item.totalFrecencyScore).toBe("number")
  })
})

describe("FFF binding - Score fields", () => {
  test("Score has numeric total and baseScore", () => {
    const result = doSearch("flake.nix")
    const score = result.scores[0]
    expect(typeof score.total).toBe("number")
    expect(typeof score.baseScore).toBe("number")
  })

  test("Score has all expected numeric fields", () => {
    const result = doSearch("flake.nix")
    const score = result.scores[0]
    expect(typeof score.filenameBonus).toBe("number")
    expect(typeof score.specialFilenameBonus).toBe("number")
    expect(typeof score.frecencyBoost).toBe("number")
    expect(typeof score.distancePenalty).toBe("number")
    expect(typeof score.currentFilePenalty).toBe("number")
    expect(typeof score.comboMatchBoost).toBe("number")
  })

  test("Score exactMatch is a boolean", () => {
    const result = doSearch("flake.nix")
    expect(typeof result.scores[0].exactMatch).toBe("boolean")
  })

  test("Score matchType is a string", () => {
    const result = doSearch("flake.nix")
    expect(typeof result.scores[0].matchType).toBe("string")
  })
})

describe("FFF binding - grep", () => {
  test("grep for 'import' returns at least 1 result", () => {
    const result = doGrep("import")
    expect(result.items.length).toBeGreaterThanOrEqual(1)
  })

  test("all grep results have non-empty path", () => {
    const result = doGrep("import")
    for (const item of result.items) {
      expect(item.path.length).toBeGreaterThan(0)
    }
  })

  test("all grep results have positive lineNumber", () => {
    const result = doGrep("import")
    for (const item of result.items) {
      expect(item.lineNumber).toBeGreaterThan(0)
    }
  })

  test("all grep results contain 'import' in lineContent", () => {
    const result = doGrep("import")
    for (const item of result.items) {
      expect(item.lineContent.toLowerCase()).toContain("import")
    }
  })

  test("grep totalMatched is at least the returned count", () => {
    const result = doGrep("import")
    expect(result.totalMatched).toBeGreaterThanOrEqual(result.items.length)
  })

  test("grep totalFilesSearched is positive", () => {
    const result = doGrep("import")
    expect(result.totalFilesSearched).toBeGreaterThan(0)
  })
})

describe("FFF binding - GrepMatch fields", () => {
  test("matchRanges is an array", () => {
    const result = doGrep("import")
    const item = result.items[0]
    expect(Array.isArray(item.matchRanges)).toBe(true)
  })

  test("matchRanges have start and end as numbers", () => {
    const result = doGrep("import")
    const item = result.items[0]
    if (item.matchRanges.length > 0) {
      expect(typeof item.matchRanges[0].start).toBe("number")
      expect(typeof item.matchRanges[0].end).toBe("number")
      expect(item.matchRanges[0].end).toBeGreaterThanOrEqual(item.matchRanges[0].start)
    }
  })

  test("contextBefore and contextAfter are arrays", () => {
    const result = doGrep("import")
    const item = result.items[0]
    expect(Array.isArray(item.contextBefore)).toBe(true)
    expect(Array.isArray(item.contextAfter)).toBe(true)
  })

  test("GrepMatch col is a non-negative number", () => {
    const result = doGrep("import")
    for (const item of result.items) {
      expect(item.col).toBeGreaterThanOrEqual(0)
    }
  })

  test("GrepMatch fileName is non-empty", () => {
    const result = doGrep("import")
    for (const item of result.items) {
      expect(item.fileName.length).toBeGreaterThan(0)
    }
  })

  test("GrepMatch size and modified are numbers", () => {
    const result = doGrep("import")
    const item = result.items[0]
    expect(typeof item.size).toBe("number")
    expect(typeof item.modified).toBe("number")
  })

  test("GrepMatch isDefinition and isBinary are booleans", () => {
    const result = doGrep("import")
    const item = result.items[0]
    expect(typeof item.isDefinition).toBe("boolean")
    expect(typeof item.isBinary).toBe("boolean")
  })

  test("GrepMatch fuzzyScore is null in plain mode", () => {
    const result = doGrep("import", 0)
    const item = result.items[0]
    expect(item.fuzzyScore).toBeNull()
  })
})

describe("FFF binding - multi-grep", () => {
  test("multi-grep for ['import', 'export'] returns at least 1 result", () => {
    const result = doMultiGrep(["import", "export"])
    expect(result.items.length).toBeGreaterThanOrEqual(1)
  })

  test("multi-grep results have valid structure", () => {
    const result = doMultiGrep(["import", "export"])
    for (const item of result.items) {
      expect(item.path.length).toBeGreaterThan(0)
      expect(item.lineNumber).toBeGreaterThan(0)
      expect(item.lineContent.length).toBeGreaterThan(0)
    }
  })
})

describe("FFF binding - directory search", () => {
  test("directory search for 'nix' returns at least 1 result", () => {
    const result = doDirSearch("nix")
    expect(result.items.length).toBeGreaterThanOrEqual(1)
  })

  test("directory items have non-empty path and dirName", () => {
    const result = doDirSearch("nix")
    for (const item of result.items) {
      expect(item.path.length).toBeGreaterThan(0)
      expect(item.dirName.length).toBeGreaterThan(0)
    }
  })

  test("directory search scores have numeric total", () => {
    const result = doDirSearch("nix")
    expect(result.scores.length).toBeGreaterThanOrEqual(1)
    expect(typeof result.scores[0].total).toBe("number")
  })

  test("totalDirs is positive", () => {
    const result = doDirSearch("nix")
    expect(result.totalDirs).toBeGreaterThan(0)
  })

  test("totalMatched reflects matches", () => {
    const result = doDirSearch("nix")
    expect(result.totalMatched).toBeGreaterThanOrEqual(result.items.length)
  })
})

describe("FFF binding - mixed search", () => {
  test("mixed search for 'nix' returns at least 1 result", () => {
    const result = doMixedSearch("nix")
    expect(result.items.length).toBeGreaterThanOrEqual(1)
  })

  test("all mixed items have type 'file' or 'directory'", () => {
    const result = doMixedSearch("nix")
    for (const item of result.items) {
      expect(["file", "directory"]).toContain(item.type)
    }
  })

  test("mixed items have non-empty path and displayName", () => {
    const result = doMixedSearch("nix")
    for (const item of result.items) {
      expect(item.path.length).toBeGreaterThan(0)
      expect(item.displayName.length).toBeGreaterThan(0)
    }
  })

  test("mixed search returns both files and directories", () => {
    const result = doMixedSearch("nix")
    const types = new Set(result.items.map((i) => i.type))
    expect(types.size).toBeGreaterThanOrEqual(1)
  })

  test("mixed search totalFiles and totalDirs are non-negative", () => {
    const result = doMixedSearch("nix")
    expect(result.totalFiles).toBeGreaterThanOrEqual(0)
    expect(result.totalDirs).toBeGreaterThanOrEqual(0)
  })

  test("mixed search scores match items count", () => {
    const result = doMixedSearch("nix")
    expect(result.scores.length).toBe(result.items.length)
  })
})

describe("FFF binding - scan progress", () => {
  test("scannedFilesCount is positive after scan completes", () => {
    const progress = doGetScanProgress()
    expect(progress.scannedFilesCount).toBeGreaterThan(0)
  })

  test("isScanning is false after scan completes", () => {
    const progress = doGetScanProgress()
    expect(progress.isScanning).toBe(false)
  })

  test("all scan progress fields are the correct type", () => {
    const progress = doGetScanProgress()
    expect(typeof progress.scannedFilesCount).toBe("number")
    expect(typeof progress.isScanning).toBe("boolean")
    expect(typeof progress.isWatcherReady).toBe("boolean")
    expect(typeof progress.isWarmupComplete).toBe("boolean")
  })
})

describe("FFF binding - health check", () => {
  test("healthCheck returns a non-null object", () => {
    const result = doHealthCheck()
    expect(result).not.toBeNull()
    expect(typeof result).toBe("object")
  })

  test("healthCheck with test path returns a non-null object", () => {
    const result = doHealthCheck(BASE_PATH)
    expect(result).not.toBeNull()
    expect(typeof result).toBe("object")
  })
})
