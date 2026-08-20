import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { MachineLoader } from "../../../MachineLoader";
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

const CONFIG_PATH = "/Users/r17/.config/nixpkgs/.anakmagang/config.yaml";

const TestLayer = MachineLoader.layer.pipe(
  Layer.provideMerge(Config.layer),
  Layer.provideMerge(BunServices.layer),
);

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer) as Effect.Effect<A, E>);

describe("Load Operations", () => {
  test('loadPreset("default")', async () => {
    await measureAsync('loadPreset("default")', async () => {
      await run(
        Effect.gen(function* () {
          const loader = yield* MachineLoader;
          return yield* loader.loadPreset("orchestrate");
        }),
      );
    });
  });

  test("loadFromFile", async () => {
    await measureAsync("loadFromFile", async () => {
      await run(
        Effect.gen(function* () {
          const loader = yield* MachineLoader;
          return yield* loader.loadFromFile(CONFIG_PATH);
        }),
      );
    });
  });
});

describe("Generate Operations", () => {
  test("generate(config, tmpDir, {force:true})", async () => {
    await measureAsync("generate(config, tmpDir, {force:true})", async () => {
      const tmpDir = `/tmp/bench-machine-loader-${Date.now()}`;
      await run(
        Effect.gen(function* () {
          const loader = yield* MachineLoader;
          const config = yield* loader.loadPreset("orchestrate");
          return yield* loader.generate(config, tmpDir, { force: true });
        }),
      );
    });
  });
});
