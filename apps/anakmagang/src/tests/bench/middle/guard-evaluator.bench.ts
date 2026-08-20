import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import {
  GuardEvaluator,
  type GuardContext,
  type GuardConfig,
  type HookInput,
  type HookEnv,
} from "../../../guard";

const ITERATIONS = 100;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const layers = GuardEvaluator.layer.pipe(Layer.provideMerge(BunServices.layer));

const run = <A>(effect: Effect.Effect<A, unknown, GuardEvaluator>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layers)));

const baseInput: HookInput = {
  tool_name: "Write",
  tool_input: {
    file_path: "/Users/r17/.config/nixpkgs/apps/anakmagang/src/foo.ts",
    content: "hello",
  },
};

const baseEnv: HookEnv = {
  CLAUDE_PROJECT_DIR: "/Users/r17/.config/nixpkgs",
  CLAUDE_AGENT_NAME: "effect-ts",
};

const pureGuard: GuardConfig = {
  type: "agent-first",
  event: "tool_use",
  matcher: "Write|Edit",
};

const outputLocationGuard: GuardConfig = {
  type: "output-location",
  event: "tool_use",
  matcher: "Write|Edit",
  restricted_paths: ["/etc", "/tmp"],
  restricted_prefixes: ["/usr"],
};

const compactionGuard: GuardConfig = {
  type: "compaction-gate",
  event: "tool_use",
  warn_at: 70,
  max: 85,
};

const iterationGuard: GuardConfig = {
  type: "iteration-limit",
  event: "tool_use",
  max: 50,
};

const blockingGuard: GuardConfig = {
  type: "agent-first",
  event: "tool_use",
  matcher: "Write|Edit",
};

describe("Single Guard Evaluation", () => {
  test("evaluate a pure guard (agent-first)", async () => {
    await measureAsync("evaluate a pure guard (agent-first)", async () => {
      await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const ctx: GuardContext = { input: baseInput, env: baseEnv, guard: pureGuard };
          return yield* evaluator.evaluate(ctx);
        }),
      );
    });
  });

  test("evaluate a guard with deps (output-location)", async () => {
    await measureAsync("evaluate a guard with deps (output-location)", async () => {
      await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const ctx: GuardContext = { input: baseInput, env: baseEnv, guard: outputLocationGuard };
          return yield* evaluator.evaluate(ctx);
        }),
      );
    });
  });
});

describe("Full Chain Evaluation", () => {
  test("evaluateAll with 3 pure guards", async () => {
    await measureAsync("evaluateAll with 3 pure guards", async () => {
      const guards: ReadonlyArray<GuardConfig> = [
        { ...pureGuard, type: "agent-first" },
        { ...pureGuard, type: "agent-first" },
        { ...pureGuard, type: "agent-first" },
      ];
      await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluateAll(guards, "tool_use", undefined, baseInput, baseEnv);
        }),
      );
    });
  });

  test("evaluateAll with 5 mixed guards (some allow, one warns)", async () => {
    await measureAsync("evaluateAll with 5 mixed guards (some allow, one warns)", async () => {
      const inputWithContext: HookInput = {
        ...baseInput,
        context_window: { used_percentage: 75 },
      };
      const guards: ReadonlyArray<GuardConfig> = [
        pureGuard,
        outputLocationGuard,
        { ...compactionGuard, warn_at: 70, max: 85 },
        iterationGuard,
        { ...pureGuard, type: "agent-first" },
      ];
      await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluateAll(
            guards,
            "tool_use",
            undefined,
            inputWithContext,
            baseEnv,
          );
        }),
      );
    });
  });

  test("evaluateAll with a blocking guard early in chain (short-circuit)", async () => {
    await measureAsync(
      "evaluateAll with a blocking guard early in chain (short-circuit)",
      async () => {
        const coordinatorEnv: HookEnv = {
          CLAUDE_PROJECT_DIR: "/Users/r17/.config/nixpkgs",
        };
        const guards: ReadonlyArray<GuardConfig> = [
          blockingGuard,
          outputLocationGuard,
          compactionGuard,
          iterationGuard,
          { ...pureGuard, type: "agent-first" },
        ];
        await run(
          Effect.gen(function* () {
            const evaluator = yield* GuardEvaluator;
            return yield* evaluator.evaluateAll(
              guards,
              "tool_use",
              undefined,
              baseInput,
              coordinatorEnv,
            );
          }),
        );
      },
    );
  });
});
