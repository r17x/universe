import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { Bridge } from "../../../Bridge";
import { EventLog, type ManifestEvent } from "../../../EventLog";
import { Config } from "../../../Config";
import { SessionId } from "../../../Ulid";

const ITERATIONS = 100;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const tempDir = mkdtempSync(join(tmpdir(), "bridge-bench-"));

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

const EventLogLayer = EventLog.bare.pipe(
  Layer.provide(testConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const BridgeLayer = Bridge.layer.pipe(Layer.provideMerge(EventLogLayer));

const layers = Layer.mergeAll(BridgeLayer, BunServices.layer);

const run = <A>(effect: Effect.Effect<A, unknown, Bridge | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layers)));

const sid = SessionId("bench-bridge-session");
const client = "claude";
const clientSid = "bench-client-001";
const ts = "2026-01-01T00:00:00Z";

const taskStartEvent: ManifestEvent = { type: "task_start", task: "bench task", ts };
const phaseAdvanceEvent: ManifestEvent = {
  type: "phase_advance",
  phase: "setup",
  reflection: "bench setup",
  ts,
};

const bridgePayload = {
  context_window: { used_percentage: 42 },
  transcript_path: "/tmp/bench.jsonl",
  last_seen: ts,
  current_task: "bench task",
  current_phase: "implementation",
};

await run(
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    yield* eventLog.createSession(sid);
    yield* eventLog.appendManifest(sid, taskStartEvent);
    yield* eventLog.appendManifest(sid, phaseAdvanceEvent);
    const bridge = yield* Bridge;
    yield* bridge.upsert(sid, client, clientSid, bridgePayload);
  }),
);

describe("Bridge Operations", () => {
  test("upsert", async () => {
    await measureAsync("upsert", async () => {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, client, "bench-upsert-iter", {
            last_seen: ts,
            context_window: { used_percentage: 50 },
          });
        }),
      );
    });
  });

  test("resolve", async () => {
    await measureAsync("resolve", async () => {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.resolve(client, clientSid);
        }),
      );
    });
  });

  test("read", async () => {
    await measureAsync("read", async () => {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.read(sid, client, clientSid);
        }),
      );
    });
  });
});

process.on("exit", () => {
  rmSync(tempDir, { recursive: true, force: true });
});
