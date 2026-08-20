import { describe, test } from "bun:test";
import { Array as Arr, Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { MemoryStore, type MemoryDir } from "../../../MemoryStore";
import type { MemoryNodeInput } from "../../../MemoryParser";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ITERATIONS = 100;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const SEED_COUNT = 20;

const seedInputs: readonly MemoryNodeInput[] = Arr.range(0, SEED_COUNT - 1).map(
  (i): MemoryNodeInput => ({
    name: `bench-node-${i}`,
    description: `Benchmark fixture node number ${i}`,
    type: (["project", "feedback", "reference", "user"] as const)[i % 4],
    scale: (["observation", "finding", "learning", "principle"] as const)[i % 4],
    tags: i % 3 === 0 ? ["tagged", "searchable"] : i % 3 === 1 ? ["tagged"] : [],
    body: `Body content for benchmark node ${i}. Keywords: memory store benchmark performance.`,
    source: "permanent",
  }),
);

const makeTempLayer = async () => {
  const tmp = await mkdtemp(join(tmpdir(), "memstore-bench-"));
  const dirs: readonly MemoryDir[] = [{ path: join(tmp, "memories"), source: "permanent" }];
  return MemoryStore.layerFrom(dirs).pipe(Layer.provideMerge(BunServices.layer));
};

const seedStore = (layers: Layer.Layer<MemoryStore>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* MemoryStore;
      yield* Effect.forEach(seedInputs, (input) => store.create(input));
    }).pipe(Effect.provide(layers)),
  );

const seededLayer = await (async () => {
  const layers = await makeTempLayer();
  await seedStore(layers);
  return layers;
})();

const run = <A>(effect: Effect.Effect<A, unknown, MemoryStore>) =>
  Effect.runPromise(effect.pipe(Effect.provide(seededLayer)));

let createCounter = 0;

describe("MemoryStore CRUD", () => {
  test("create", async () => {
    await measureAsync("create", async () => {
      createCounter++;
      const freshLayers = await makeTempLayer();
      await Effect.runPromise(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.create({
            name: `create-bench-${createCounter}`,
            description: "Created during benchmark",
            type: "project",
          });
        }).pipe(Effect.provide(freshLayers)),
      );
    });
  });

  test("read", async () => {
    await measureAsync("read", async () => {
      await run(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.read("bench-node-0");
        }),
      );
    });
  });

  test("list", async () => {
    await measureAsync("list", async () => {
      await run(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.list();
        }),
      );
    });
  });

  test("list with filter", async () => {
    await measureAsync("list with filter", async () => {
      await run(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.list({ tag: "tagged", scale: "observation" });
        }),
      );
    });
  });

  test("query", async () => {
    await measureAsync("query", async () => {
      await run(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.query(["benchmark", "performance"]);
        }),
      );
    });
  });
});

describe("MemoryStore Lifecycle", () => {
  test("status", async () => {
    await measureAsync("status", async () => {
      await run(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.status();
        }),
      );
    });
  });

  test("promote", async () => {
    await measureAsync("promote", async () => {
      const freshLayers = await makeTempLayer();
      await seedStore(freshLayers);
      await Effect.runPromise(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.promote("bench-node-0", []);
        }).pipe(Effect.provide(freshLayers)),
      );
    });
  });

  test("transition", async () => {
    await measureAsync("transition", async () => {
      const freshLayers = await makeTempLayer();
      await seedStore(freshLayers);
      await Effect.runPromise(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.transition("bench-node-1", "STALE");
        }).pipe(Effect.provide(freshLayers)),
      );
    });
  });

  test("prune", async () => {
    await measureAsync("prune", async () => {
      const freshLayers = await makeTempLayer();
      await seedStore(freshLayers);
      await Effect.runPromise(
        Effect.gen(function* () {
          const store = yield* MemoryStore;
          return yield* store.prune({ project: -1, feedback: -1, reference: -1, user: -1 });
        }).pipe(Effect.provide(freshLayers)),
      );
    });
  });
});
