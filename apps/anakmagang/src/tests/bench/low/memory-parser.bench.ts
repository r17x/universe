import { describe, test } from "bun:test";
import { Effect } from "effect";
import {
  increment,
  matchesFilter,
  parseMemoryFrontmatter,
  serializeNode,
  todayString,
  toId,
} from "../../../MemoryParser";
import type { MemoryFilter, MemoryNode } from "../../../MemoryParser";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const validFrontmatter = `---
name: Test Memory Node
description: A benchmark fixture for parsing
type: project
scale: finding
state: ACTIVE
updated: "2026-05-22"
session_count: 3
edges:
  derived_from:
    - parent-node-1
tags:
  - benchmark
  - testing
source: permanent
---
This is the body content of the memory node.
`;

const fixtureNode: MemoryNode = {
  id: "test-memory-node",
  name: "Test Memory Node",
  description: "A benchmark fixture for serialization",
  type: "project",
  scale: "finding",
  state: "ACTIVE",
  updated: "2026-05-22",
  session_count: 3,
  edges: { derived_from: ["parent-node-1"] },
  tags: ["benchmark", "testing"],
  body: "This is the body content of the memory node.\n",
  source: "permanent",
};

const filterByTag: MemoryFilter = { tag: "benchmark" };
const filterByScale: MemoryFilter = { scale: "finding" };
const filterByText: MemoryFilter = { text: "fixture" };
const filterCombined: MemoryFilter = {
  tag: "benchmark",
  scale: "finding",
  state: "ACTIVE",
  text: "benchmark",
};
const filterNoMatch: MemoryFilter = { tag: "nonexistent" };

describe("MemoryParser", () => {
  test("toId — slugify complex name", () => {
    measure("toId — slugify complex name", () => {
      toId("Some Complex Name!");
    });
  });

  test("todayString — date formatting", () => {
    measure("todayString — date formatting", () => {
      Effect.runSync(todayString);
    });
  });

  test("parseMemoryFrontmatter — valid content", () => {
    measure("parseMemoryFrontmatter — valid content", () => {
      Effect.runSync(parseMemoryFrontmatter(validFrontmatter, "test-id"));
    });
  });

  test("serializeNode — full node", () => {
    measure("serializeNode — full node", () => {
      serializeNode(fixtureNode);
    });
  });

  test("matchesFilter — single tag filter", () => {
    measure("matchesFilter — single tag filter", () => {
      matchesFilter(fixtureNode, filterByTag);
    });
  });

  test("matchesFilter — single scale filter", () => {
    measure("matchesFilter — single scale filter", () => {
      matchesFilter(fixtureNode, filterByScale);
    });
  });

  test("matchesFilter — text search filter", () => {
    measure("matchesFilter — text search filter", () => {
      matchesFilter(fixtureNode, filterByText);
    });
  });

  test("matchesFilter — combined filters (match)", () => {
    measure("matchesFilter — combined filters (match)", () => {
      matchesFilter(fixtureNode, filterCombined);
    });
  });

  test("matchesFilter — no match", () => {
    measure("matchesFilter — no match", () => {
      matchesFilter(fixtureNode, filterNoMatch);
    });
  });

  test("increment — existing key", () => {
    measure("increment — existing key", () => {
      increment({ alpha: 5, beta: 2 }, "alpha");
    });
  });

  test("increment — new key", () => {
    measure("increment — new key", () => {
      increment({ alpha: 5 }, "gamma");
    });
  });
});
