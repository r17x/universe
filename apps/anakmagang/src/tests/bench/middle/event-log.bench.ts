import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { EventLog, type ManifestEvent, type LogEvent } from "../../../EventLog";
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

const tempDir = mkdtempSync(join(tmpdir(), "eventlog-bench-"));
mkdirSync(join(tempDir, "out"), { recursive: true });
mkdirSync(join(tempDir, ".anakmagang"), { recursive: true });
writeFileSync(join(tempDir, ".anakmagang", "config.yaml"), "");

const benchConfigLayer = Layer.succeed(
  Config,
  Config.of({
    root: tempDir,
    configPath: join(tempDir, ".anakmagang", "config.yaml"),
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

const benchLayers = EventLog.bare.pipe(
  Layer.provide(benchConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const run = <A, E>(effect: Effect.Effect<A, E, EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(benchLayers)));

const ts = "2026-01-01T00:00:00Z";
let writeCounter = 0;
const uniqueSid = (prefix: string) => SessionId(`${prefix}-${Date.now()}-${writeCounter++}`);

const taskStartEvent = (task: string, size?: string): ManifestEvent => ({
  type: "task_start",
  task,
  ...(size !== undefined ? { size } : {}),
  ts,
});

const phaseAdvanceEvent = (phase: string, reflection: string): ManifestEvent => ({
  type: "phase_advance",
  phase,
  reflection,
  ts,
});

const observationEvent = (text: string): ManifestEvent => ({
  type: "observation",
  text,
  ts,
});

const iterationEvent = (agent: string, taskHash: string): LogEvent => ({
  type: "iteration",
  agent,
  task_hash: taskHash,
  ts,
});

const readSid = SessionId(`session-read-bench-${Date.now()}`);

const setupReadSession = async () => {
  await run(
    Effect.gen(function* () {
      const el = yield* EventLog;
      yield* el.createSession(readSid);
      yield* el.appendManifest(readSid, taskStartEvent("bench task", "MEDIUM"));
      yield* el.appendManifest(readSid, phaseAdvanceEvent("setup", "setup reflection"));
      yield* el.appendManifest(readSid, phaseAdvanceEvent("triage", "triage reflection"));
      yield* el.appendManifest(readSid, phaseAdvanceEvent("discovery", "discovery reflection"));
      yield* el.appendManifest(readSid, observationEvent("first observation"));
      yield* el.appendManifest(readSid, observationEvent("second observation"));
      yield* el.appendLog(readSid, iterationEvent("effect-ts", "hash1"));
      yield* el.appendLog(readSid, iterationEvent("effect-ts", "hash1"));
      yield* el.appendLog(readSid, iterationEvent("nix-coder", "hash2"));
      yield* el.addArtifact(readSid, {
        path: "plan.md",
        source: "coordinator",
        tags: ["plan"],
        size: 512,
      });
      yield* el.addArtifact(readSid, {
        path: "output.ts",
        source: "worker",
        tags: ["code", "artifact"],
        size: 1024,
      });
    }),
  );
};

await setupReadSession();

describe("Write Operations", () => {
  test("appendManifest (task_start)", async () => {
    await measureAsync("appendManifest (task_start)", async () => {
      const sid = uniqueSid("bench-write-start");
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.createSession(sid);
          yield* el.appendManifest(sid, taskStartEvent("bench task"));
        }),
      );
    });
  });

  test("appendManifest (phase_advance)", async () => {
    await measureAsync("appendManifest (phase_advance)", async () => {
      const sid = uniqueSid("bench-write-phase");
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.createSession(sid);
          yield* el.appendManifest(sid, taskStartEvent("bench task"));
          yield* el.appendManifest(sid, phaseAdvanceEvent("setup", "reflected on setup"));
        }),
      );
    });
  });

  test("appendLog (iteration)", async () => {
    await measureAsync("appendLog (iteration)", async () => {
      const sid = uniqueSid("bench-write-iter");
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.createSession(sid);
          yield* el.appendLog(sid, iterationEvent("effect-ts", "hash1"));
        }),
      );
    });
  });
});

describe("Read Operations", () => {
  test("currentPhase", async () => {
    await measureAsync("currentPhase", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.currentPhase(readSid);
        }),
      );
    });
  });

  test("currentTask", async () => {
    await measureAsync("currentTask", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.currentTask(readSid);
        }),
      );
    });
  });

  test("reflections", async () => {
    await measureAsync("reflections", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.reflections(readSid);
        }),
      );
    });
  });

  test("observations", async () => {
    await measureAsync("observations", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.observations(readSid);
        }),
      );
    });
  });

  test("completedPhases", async () => {
    await measureAsync("completedPhases", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.completedPhases(readSid);
        }),
      );
    });
  });

  test("taskSize", async () => {
    await measureAsync("taskSize", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.taskSize(readSid);
        }),
      );
    });
  });
});

describe("Query Operations", () => {
  test("listSessions", async () => {
    await measureAsync("listSessions", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.listSessions();
        }),
      );
    });
  });

  test("findActiveSession", async () => {
    await measureAsync("findActiveSession", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.findActiveSession();
        }),
      );
    });
  });

  test("iterationCount", async () => {
    await measureAsync("iterationCount", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.iterationCount(readSid, "effect-ts", "hash1");
        }),
      );
    });
  });

  test("isActive", async () => {
    await measureAsync("isActive", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.isActive(readSid);
        }),
      );
    });
  });

  test("isDraft", async () => {
    await measureAsync("isDraft", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.isDraft(readSid);
        }),
      );
    });
  });
});

describe("Artifact Operations", () => {
  test("addArtifact", async () => {
    await measureAsync("addArtifact", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.addArtifact(readSid, {
            path: `bench-${writeCounter++}.md`,
            source: "bench",
            tags: ["test"],
            size: 256,
          });
        }),
      );
    });
  });

  test("listArtifacts", async () => {
    await measureAsync("listArtifacts", async () => {
      await run(
        Effect.gen(function* () {
          const el = yield* EventLog;
          yield* el.listArtifacts(readSid);
        }),
      );
    });
  });
});
