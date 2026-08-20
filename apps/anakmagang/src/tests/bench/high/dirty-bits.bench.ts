import { describe, test } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";
import { join } from "path";
import { DirtyBits } from "../../../DirtyBits";
import { Config } from "../../../Config";
import { EventLog } from "../../../EventLog";
import { SessionId } from "../../../Ulid";

const ITERATIONS = 10;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const tempDir = mkdtempSync(join(tmpdir(), "dirty-bits-bench-"));
const sid = SessionId(`bench-session-${Date.now()}`);

const testConfigLayer = Layer.succeed(
  Config,
  Config.of({
    root: tempDir,
    configPath: join(tempDir, "config.yaml"),
    outDir: join(tempDir, "out"),
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

const testLayers = DirtyBits.layer.pipe(
  Layer.provideMerge(EventLog.bare),
  Layer.provide(testConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const setup = Effect.gen(function* () {
  const eventLog = yield* EventLog;
  yield* eventLog.createSession(sid);
  yield* eventLog.writeJson(
    sid,
    "dirty",
    "baseline",
    ["src/existing.ts", "lib/old.ts"],
    Schema.Array(Schema.String),
  );
}).pipe(Effect.provide(testLayers));

await Effect.runPromise(setup);

const run = <A, E>(effect: Effect.Effect<A, E, DirtyBits | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayers)));

describe("DirtyBits", () => {
  test("snapshot", async () => {
    await measureAsync("snapshot", async () => {
      await run(
        Effect.gen(function* () {
          const dirtyBits = yield* DirtyBits;
          yield* dirtyBits.snapshot(sid);
        }),
      );
    });
  });

  test("diff", async () => {
    await measureAsync("diff", async () => {
      await run(
        Effect.gen(function* () {
          const dirtyBits = yield* DirtyBits;
          yield* dirtyBits.diff(sid);
        }),
      );
    });
  });

  test("runOnAdvance", async () => {
    await measureAsync("runOnAdvance", async () => {
      await run(
        Effect.gen(function* () {
          const dirtyBits = yield* DirtyBits;
          yield* dirtyBits.runOnAdvance(
            sid,
            "implementation",
            [{ command: "echo {dirty-files}" }],
            ["src/changed.ts", "lib/new.ts"],
          );
        }),
      );
    });
  });
});
