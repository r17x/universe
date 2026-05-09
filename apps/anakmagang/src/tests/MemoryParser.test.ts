import { describe, test, expect } from "bun:test"
import { Effect } from "effect"
import {
  toId,
  todayString,
  serializeNode,
  parseMemoryFrontmatter,
  matchesFilter,
  type MemoryNode,
  type MemoryFilter,
} from "../MemoryParser"

describe("toId", () => {
  test("converts spaced words to kebab-case", () => {
    expect(toId("Hello World")).toBe("hello-world")
  })

  test("strips non-alphanumeric characters", () => {
    expect(toId("Test 123!")).toBe("test-123")
  })

  test("empty string returns empty", () => {
    expect(toId("")).toBe("")
  })

  test("already kebab-case passes through", () => {
    expect(toId("already-kebab")).toBe("already-kebab")
  })
})

describe("todayString", () => {
  test("returns YYYY-MM-DD format", () => {
    const result = todayString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("serializeNode", () => {
  const node: MemoryNode = {
    id: "test-node",
    name: "Test Node",
    description: "A test node",
    type: "project",
    scale: "observation",
    state: "ACTIVE",
    updated: "2026-01-01",
    session_count: 3,
    edges: { derived_from: ["dep-a", "dep-b"] },
    tags: ["tag1", "tag2"],
    body: "Some body content",
    source: "permanent",
  }

  test("starts with frontmatter delimiter", () => {
    const result = serializeNode(node)
    expect(result.startsWith("---\n")).toBe(true)
  })

  test("contains all fields", () => {
    const result = serializeNode(node)
    expect(result).toContain('id: "test-node"')
    expect(result).toContain('name: "Test Node"')
    expect(result).toContain('description: "A test node"')
    expect(result).toContain("type: project")
    expect(result).toContain("scale: observation")
    expect(result).toContain("state: ACTIVE")
    expect(result).toContain('updated: "2026-01-01"')
    expect(result).toContain("session_count: 3")
    expect(result).toContain('derived_from: ["dep-a", "dep-b"]')
    expect(result).toContain('tags: ["tag1", "tag2"]')
    expect(result).toContain("source: permanent")
  })

  test("ends with body after closing delimiter", () => {
    const result = serializeNode(node)
    expect(result).toContain("---\nSome body content")
  })
})

describe("parseMemoryFrontmatter", () => {
  test("roundtrip: serialize then parse with empty collections", async () => {
    const node: MemoryNode = {
      id: "roundtrip",
      name: "Roundtrip Node",
      description: "Testing roundtrip",
      type: "feedback",
      scale: "finding",
      state: "ACTIVE",
      updated: "2026-05-01",
      session_count: 2,
      edges: { derived_from: [] },
      tags: [],
      body: "Body text here",
      source: "permanent",
    }
    const serialized = serializeNode(node)
    const result = await Effect.runPromise(parseMemoryFrontmatter(serialized, "roundtrip"))
    expect(result.id).toBe("roundtrip")
    expect(result.name).toBe("Roundtrip Node")
    expect(result.description).toBe("Testing roundtrip")
    expect(result.type).toBe("feedback")
    expect(result.scale).toBe("finding")
    expect(result.state).toBe("ACTIVE")
    expect(result.session_count).toBe(2)
    expect(result.body).toBe("Body text here")
    expect(result.source).toBe("permanent")
  })

  test("missing delimiters returns MemoryNodeError", async () => {
    const exit = await Effect.runPromiseExit(
      parseMemoryFrontmatter("no frontmatter here", "bad-id")
    )
    expect(exit._tag).toBe("Failure")
  })
})

describe("matchesFilter", () => {
  const node: MemoryNode = {
    id: "filter-test",
    name: "Filter Test Node",
    description: "A description for filtering",
    type: "project",
    scale: "learning",
    state: "ACTIVE",
    updated: "2026-01-01",
    session_count: 0,
    edges: { derived_from: [] },
    tags: ["nix", "effect"],
    body: "Body with keyword unicorn",
    source: "permanent",
  }

  test("empty filter matches everything", () => {
    const filter: MemoryFilter = {}
    expect(matchesFilter(node, filter)).toBe(true)
  })

  test("tag filter works", () => {
    expect(matchesFilter(node, { tag: "nix" })).toBe(true)
    expect(matchesFilter(node, { tag: "missing" })).toBe(false)
  })

  test("scale filter works", () => {
    expect(matchesFilter(node, { scale: "learning" })).toBe(true)
    expect(matchesFilter(node, { scale: "principle" })).toBe(false)
  })

  test("state filter works", () => {
    expect(matchesFilter(node, { state: "ACTIVE" })).toBe(true)
    expect(matchesFilter(node, { state: "STALE" })).toBe(false)
  })

  test("text filter searches name, description, and body", () => {
    expect(matchesFilter(node, { text: "unicorn" })).toBe(true)
    expect(matchesFilter(node, { text: "Filter Test" })).toBe(true)
    expect(matchesFilter(node, { text: "filtering" })).toBe(true)
    expect(matchesFilter(node, { text: "nonexistent" })).toBe(false)
  })
})
