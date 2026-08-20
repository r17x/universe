import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { MemoryStore, MemoryNodeError } from "../MemoryStore";
import type { MemoryNodeInput } from "../MemoryParser";

const tempDir = mkdtempSync(join(tmpdir(), "memory-promote-test-"));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const TestLayer = MemoryStore.layerFrom([{ path: tempDir, source: "permanent" }]).pipe(
  Layer.provideMerge(BunServices.layer),
);

const run = <A, E>(effect: Effect.Effect<A, E, MemoryStore>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

const makeNode = (name: string, overrides?: Partial<MemoryNodeInput>): MemoryNodeInput => ({
  name,
  description: `Test node ${name}`,
  type: "project",
  ...overrides,
});

describe("MemoryStore.promote", () => {
  test("promote with self-reference fails", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("self-ref-node"));
        return yield* store.promote("self-ref-node", ["self-ref-node"]).pipe(Effect.flip);
      }),
    );
    expect(result).toBeInstanceOf(MemoryNodeError);
    expect(result.message).toContain("Self-referencing edge not allowed");
  });

  test("promote with valid derivedFrom succeeds and increments scale", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("valid-base"));
        yield* store.create(makeNode("valid-target"));
        return yield* store.promote("valid-target", ["valid-base"]);
      }),
    );
    expect(result.scale).toBe("finding");
    expect(result.edges.derived_from).toContain("valid-base");
  });

  test("promote A->B then promote B with derivedFrom:[A] fails (transitive cycle A->B->A)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("cycle-a"));
        yield* store.create(makeNode("cycle-b"));
        yield* store.promote("cycle-a", ["cycle-b"]);
        return yield* store.promote("cycle-b", ["cycle-a"]).pipe(Effect.flip);
      }),
    );
    expect(result).toBeInstanceOf(MemoryNodeError);
    expect(result.message).toContain("would create a cycle");
  });

  test("promote with 3-node chain A->B->C then C with derivedFrom:[A] fails (A->B->C->A)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("chain-a"));
        yield* store.create(makeNode("chain-b"));
        yield* store.create(makeNode("chain-c"));
        yield* store.promote("chain-b", ["chain-a"]);
        yield* store.promote("chain-c", ["chain-b"]);
        return yield* store.promote("chain-a", ["chain-c"]).pipe(Effect.flip);
      }),
    );
    expect(result).toBeInstanceOf(MemoryNodeError);
    expect(result.message).toContain("would create a cycle");
  });

  test("promote with non-existent derivedFrom fails", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("orphan-node"));
        return yield* store.promote("orphan-node", ["does-not-exist"]).pipe(Effect.flip);
      }),
    );
    expect(result).toBeInstanceOf(MemoryNodeError);
    expect(result.message).toContain("Derived-from node not found");
  });

  test("promote non-ACTIVE node fails", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("stale-node"));
        yield* store.transition("stale-node", "STALE");
        return yield* store.promote("stale-node", []).pipe(Effect.flip);
      }),
    );
    expect(result).toBeInstanceOf(MemoryNodeError);
    expect(result.message).toContain("Cannot promote non-ACTIVE node");
  });

  test("promote at max scale (principle) fails", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create(makeNode("max-scale-node"));
        yield* store.create(makeNode("dep-1"));
        yield* store.create(makeNode("dep-2"));
        yield* store.create(makeNode("dep-3"));
        yield* store.promote("max-scale-node", ["dep-1"]);
        yield* store.promote("max-scale-node", ["dep-2"]);
        yield* store.promote("max-scale-node", ["dep-3"]);
        return yield* store.promote("max-scale-node", []).pipe(Effect.flip);
      }),
    );
    expect(result).toBeInstanceOf(MemoryNodeError);
    expect(result.message).toContain("Cannot promote beyond principle");
  });
});
