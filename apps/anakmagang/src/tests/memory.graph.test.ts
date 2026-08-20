import { describe, test, expect } from "bun:test";
import { HashMap, HashSet } from "effect";
import { nodeLabel, renderTree, renderDot } from "../memory.graph";
import type { MemoryNode } from "../MemoryParser";

const makeNode = (
  id: string,
  name: string,
  scale: string,
  derivedFrom: readonly string[],
): MemoryNode => ({
  id,
  name,
  description: "",
  type: "feedback",
  scale: scale as MemoryNode["scale"],
  state: "ACTIVE",
  updated: "2026-01-01",
  session_count: 0,
  edges: { derived_from: derivedFrom },
  tags: [],
  body: "",
  source: "permanent",
});

describe("nodeLabel", () => {
  test("formats as id [scale] name", () => {
    const node = makeNode("my-node", "My Node", "finding", []);
    expect(nodeLabel(node)).toBe("my-node [finding] My Node");
  });

  test("includes observation scale", () => {
    const node = makeNode("obs", "Observation Node", "observation", []);
    expect(nodeLabel(node)).toBe("obs [observation] Observation Node");
  });
});

describe("renderDot", () => {
  test("empty array produces minimal digraph", () => {
    const result = renderDot([]);
    expect(result).toBe("digraph memory {\n  rankdir=BT;\n}");
  });

  test("two nodes with one edge produces correct dot output", () => {
    const parent = makeNode("parent", "Parent", "learning", []);
    const child = makeNode("child", "Child", "observation", ["parent"]);
    const result = renderDot([parent, child]);
    expect(result).toContain('"child" -> "parent";');
    expect(result).toContain('"parent" [label=');
    expect(result).toContain('"child" [label=');
    expect(result).toContain("digraph memory {");
    expect(result).toContain("rankdir=BT;");
  });

  test("node names with quotes are escaped in labels", () => {
    const node = makeNode("quoted", 'Say "hello"', "finding", []);
    const result = renderDot([node]);
    expect(result).toContain('Say \\"hello\\"');
    expect(result).not.toContain('Say "hello"');
  });

  test("node with no edges produces no edge lines", () => {
    const node = makeNode("solo", "Solo Node", "principle", []);
    const result = renderDot([node]);
    expect(result).not.toContain("->");
  });
});

describe("renderTree", () => {
  test("root with one child renders two lines starting from empty prefix", () => {
    const a = makeNode("a", "A Name", "observation", []);
    const b = makeNode("b", "B Name", "observation", ["a"]);

    const nodeMap = HashMap.fromIterable([["a", a] as const, ["b", b] as const]);
    const childrenMap = HashMap.fromIterable([["a", ["b"] as ReadonlyArray<string>] as const]);

    const lines = renderTree("a", childrenMap, nodeMap, HashSet.empty(), "", true);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("a [observation] A Name");
    expect(lines[1]).toBe("b [observation] B Name");
  });

  test("non-empty prefix produces tree connectors", () => {
    const a = makeNode("a", "A Name", "observation", []);
    const b = makeNode("b", "B Name", "observation", ["a"]);

    const nodeMap = HashMap.fromIterable([["a", a] as const, ["b", b] as const]);
    const childrenMap = HashMap.fromIterable([["a", ["b"] as ReadonlyArray<string>] as const]);

    const lines = renderTree("a", childrenMap, nodeMap, HashSet.empty(), "  ", true);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("  └── a [observation] A Name");
    expect(lines[1]).toContain("└── b [observation] B Name");
  });

  test("three-level tree renders all nodes", () => {
    const a = makeNode("a", "Root", "learning", []);
    const b = makeNode("b", "Mid", "finding", ["a"]);
    const c = makeNode("c", "Leaf", "observation", ["b"]);

    const nodeMap = HashMap.fromIterable([["a", a] as const, ["b", b] as const, ["c", c] as const]);
    const childrenMap = HashMap.fromIterable([
      ["a", ["b"] as ReadonlyArray<string>] as const,
      ["b", ["c"] as ReadonlyArray<string>] as const,
    ]);

    const lines = renderTree("a", childrenMap, nodeMap, HashSet.empty(), "", true);
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("a [learning] Root");
    expect(lines[1]).toContain("b [finding] Mid");
    expect(lines[2]).toContain("c [observation] Leaf");
  });

  test("cycle detection prevents infinite recursion", () => {
    const a = makeNode("a", "Node A", "observation", ["b"]);
    const b = makeNode("b", "Node B", "observation", ["a"]);

    const nodeMap = HashMap.fromIterable([["a", a] as const, ["b", b] as const]);
    const childrenMap = HashMap.fromIterable([
      ["a", ["b"] as ReadonlyArray<string>] as const,
      ["b", ["a"] as ReadonlyArray<string>] as const,
    ]);

    const lines = renderTree("a", childrenMap, nodeMap, HashSet.empty(), "", true);
    // Should terminate without infinite loop; "a" visited prevents re-entry
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("a [observation] Node A");
    expect(lines[1]).toContain("b [observation] Node B");
  });

  test("missing node reference returns empty array", () => {
    const nodeMap = HashMap.empty<string, MemoryNode>();
    const childrenMap = HashMap.empty<string, ReadonlyArray<string>>();

    const lines = renderTree("nonexistent", childrenMap, nodeMap, HashSet.empty(), "", true);
    expect(lines.length).toBe(0);
  });

  test("node with child referencing non-existent node still renders parent", () => {
    const a = makeNode("a", "Parent", "finding", []);

    const nodeMap = HashMap.fromIterable([["a", a] as const]);
    const childrenMap = HashMap.fromIterable([["a", ["ghost"] as ReadonlyArray<string>] as const]);

    const lines = renderTree("a", childrenMap, nodeMap, HashSet.empty(), "", true);
    // Parent renders, ghost child is skipped (not in nodeMap)
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("a [finding] Parent");
  });
});
