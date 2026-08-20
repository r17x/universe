import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { Search } from "../../../Search";

const ITERATIONS = 10;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const searchLayer = await (async () => {
  try {
    const layer = Search.layer.pipe(Layer.provideMerge(BunServices.layer));
    await Effect.runPromise(
      Effect.gen(function* () {
        const search = yield* Search;
        yield* search.isScanning();
      }).pipe(Effect.provide(layer)),
    );
    return layer;
  } catch {
    return null;
  }
})();

if (searchLayer) {
  const layer = searchLayer;
  const run = <A>(effect: Effect.Effect<A, unknown, Search>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));

  describe("Search FFI", () => {
    test('find("*.ts")', async () => {
      await measureAsync('find("*.ts")', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.find("*.ts");
          }),
        );
      });
    });

    test('find("Machine")', async () => {
      await measureAsync('find("Machine")', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.find("Machine");
          }),
        );
      });
    });

    test('grep("Effect")', async () => {
      await measureAsync('grep("Effect")', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.grep("Effect");
          }),
        );
      });
    });

    test('grep("Schema.Struct")', async () => {
      await measureAsync('grep("Schema.Struct")', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.grep("Schema.Struct");
          }),
        );
      });
    });

    test('multiGrep(["Effect", "Schema"])', async () => {
      await measureAsync('multiGrep(["Effect", "Schema"])', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.multiGrep(["Effect", "Schema"]);
          }),
        );
      });
    });

    test('findDirectories("src")', async () => {
      await measureAsync('findDirectories("src")', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.findDirectories("src");
          }),
        );
      });
    });

    test('findMixed("test")', async () => {
      await measureAsync('findMixed("test")', async () => {
        await run(
          Effect.gen(function* () {
            const search = yield* Search;
            return yield* search.findMixed("test");
          }),
        );
      });
    });
  });
} else {
  describe("Search FFI (SKIPPED — dylib not available)", () => {
    test("noop", () => {});
  });
}
