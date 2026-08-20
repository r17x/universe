import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { Config } from "../../../Config";

const ITERATIONS = 100;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const layers = Config.layer.pipe(Layer.provideMerge(BunServices.layer));

const run = <A>(effect: Effect.Effect<A, unknown, Config>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layers)));

describe("Config Discovery", () => {
  test("Config layer construction", async () => {
    await measureAsync("Config layer construction", async () => {
      await run(
        Effect.gen(function* () {
          const config = yield* Config;
          return config.root;
        }),
      );
    });
  });

  test("readConfig", async () => {
    await measureAsync("readConfig", async () => {
      await run(
        Effect.gen(function* () {
          const config = yield* Config;
          return yield* config.readConfig;
        }),
      );
    });
  });
});
