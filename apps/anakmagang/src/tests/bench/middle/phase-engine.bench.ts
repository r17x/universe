import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { PhaseEngine } from "../../../PhaseEngine";
import { EventLog } from "../../../EventLog";
import { Config } from "../../../Config";
import { MachineLoader } from "../../../MachineLoader";
import { MemoryStore, type MemoryStoreContract } from "../../../MemoryStore";
import { DirtyBits, type DirtyBitsContract } from "../../../DirtyBits";
import { GuardEvaluator, type GuardEvaluatorContract } from "../../../guard";
import { Allow } from "../../../protocol.GuardResult";
import { ulid } from "../../../Ulid";

const ITERATIONS = 100;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const tempDir = mkdtempSync(join(tmpdir(), "phase-engine-bench-"));

const configSource = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  ".anakmagang",
  "config.yaml",
);
const configTarget = join(tempDir, ".anakmagang", "config.yaml");
mkdirSync(join(tempDir, ".anakmagang"), { recursive: true });
copyFileSync(configSource, configTarget);

const benchConfigLayer = Layer.succeed(
  Config,
  Config.of({
    root: tempDir,
    configPath: configTarget,
    outDir: join(tempDir, ".anakmagang", "out"),
    socketPath: join(tempDir, ".anakmagang", "events.sock"),
    projectName: "test-project",
    webSocketPath: join(tempDir, ".anakmagang", "events.sock"),
    readConfig: Effect.die("not used in bench"),
    client: "claude",
    initialPhase: "setup",
    terminalPhase: "completion",
    terminalLabel: "completed",
    promises: [
      "IMPLEMENTATION_COMPLETE",
      "VERIFICATION_PASSED",
      "VERIFICATION_FAILED",
      "IMPLEMENTATION_BLOCKED",
      "NEEDS_COORDINATOR_INPUT",
      "REVIEW_PASSED",
      "REVIEW_ISSUES_FOUND",
      "REVIEW_BLOCKED",
    ],
    providers: [],
    phaseIds: [],
  }),
);

const mockMemoryStoreLayer = Layer.succeed(
  MemoryStore,
  MemoryStore.of({
    create: () => Effect.die("not used"),
    read: () => Effect.die("not used"),
    list: () => Effect.succeed([]),
    query: () => Effect.succeed([]),
    transition: () => Effect.die("not used"),
    promote: () => Effect.die("not used"),
    prune: () => Effect.die("not used"),
    status: () => Effect.die("not used"),
  } satisfies MemoryStoreContract),
);

const mockDirtyBitsLayer = Layer.succeed(
  DirtyBits,
  DirtyBits.of({
    snapshot: () => Effect.succeed([] as readonly string[]),
    diff: () => Effect.succeed([] as readonly string[]),
    runOnAdvance: () => Effect.void,
  } satisfies DirtyBitsContract),
);

const mockGuardEvaluatorLayer = Layer.succeed(
  GuardEvaluator,
  GuardEvaluator.of({
    evaluate: () => Effect.succeed(Allow()),
    evaluateAll: () => Effect.succeed({ results: [], guards: [] }),
  } satisfies GuardEvaluatorContract),
);

const EventLogLayer = EventLog.bare.pipe(
  Layer.provide(benchConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const BaseLayers = Layer.mergeAll(
  MachineLoader.layer,
  benchConfigLayer,
  mockMemoryStoreLayer,
  EventLogLayer,
  mockDirtyBitsLayer,
  mockGuardEvaluatorLayer,
  BunServices.layer,
);

const BenchLayer = PhaseEngine.layer.pipe(
  Layer.provide(BaseLayers),
  Layer.provideMerge(BaseLayers),
);

const run = <A, E>(effect: Effect.Effect<A, E, PhaseEngine | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BenchLayer)));

const setupSession = async () => {
  const result = await run(
    Effect.gen(function* () {
      const engine = yield* PhaseEngine;
      const startResult = yield* engine.start("bench task");
      yield* engine.eval({
        reflection: "Setup complete for bench",
        sessionId: startResult.sessionId,
        size: "SMALL",
      });
      return startResult.sessionId;
    }),
  );
  return result;
};

const readySid = await setupSession();

describe("PhaseEngine Operations", () => {
  test("start(task)", async () => {
    await measureAsync("start(task)", async () => {
      await run(
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const benchId = yield* ulid;
          yield* engine.start(`bench-${benchId}`);
        }),
      );
    });
  });

  test("eval with size", async () => {
    await measureAsync("eval with size", async () => {
      await run(
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const sizeId = yield* ulid;
          const startResult = yield* engine.start(`bench-size-${sizeId}`);
          yield* engine.eval({
            reflection: "Setup assumptions reviewed",
            sessionId: startResult.sessionId,
            size: "SMALL",
          });
        }),
      );
    });
  });

  test("eval with reflection", async () => {
    await measureAsync("eval with reflection", async () => {
      const sid = readySid;
      await run(
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          yield* engine.eval({
            reflection: "Triage reflection for bench",
            sessionId: sid,
          });
        }),
      );
    });
  });

  test("observe", async () => {
    await measureAsync("observe", async () => {
      const sid = readySid;
      await run(
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const obsId = yield* ulid;
          yield* engine.observe(`observation-${obsId}`, sid);
        }),
      );
    });
  });

  test("draft", async () => {
    await measureAsync("draft", async () => {
      await run(
        Effect.gen(function* () {
          const engine = yield* PhaseEngine;
          const draftId = yield* ulid;
          yield* engine.draft(`draft-bench-${draftId}`);
        }),
      );
    });
  });
});
