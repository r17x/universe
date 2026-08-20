declare module "bun:test" {
  export function bench(name: string, fn: () => Promise<void> | void): void;
  export function group(name: string, fn: () => void): void;
}

import { bench, group } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtempSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { EventLog, type ManifestEvent } from "../EventLog";
import { Config } from "../Config";
import { MachineLoader } from "../MachineLoader";
import { MemoryStore, type MemoryStoreContract } from "../MemoryStore";
import { DirtyBits, type DirtyBitsContract } from "../DirtyBits";
import {
  GuardEvaluator,
  type GuardEvaluatorContract,
  Allow,
  type GuardConfig,
  type HookInput,
  type HookEnv,
} from "../guard";
import { PhaseEngine } from "../PhaseEngine";
import { Bridge } from "../Bridge";
import { compactionGate } from "../guard.compaction-gate";
import { iterationLimit } from "../guard.iteration-limit";
import { sessionStopGuard } from "../guard.session-stop";
import { SessionId } from "../Ulid";

const tempDir = mkdtempSync(join(tmpdir(), "middle-bench-"));

const configSource = join(import.meta.dir, "..", "..", "..", "..", ".anakmagang", "config.yaml");
const configTarget = join(tempDir, ".anakmagang", "config.yaml");
mkdirSync(join(tempDir, ".anakmagang"), { recursive: true });
mkdirSync(join(tempDir, ".anakmagang", "out"), { recursive: true });
mkdirSync(join(tempDir, ".claude", "memories"), { recursive: true });
copyFileSync(configSource, configTarget);

const testConfigLayer = Layer.succeed(
  Config,
  Config.of({
    root: tempDir,
    configPath: configTarget,
    outDir: join(tempDir, ".anakmagang", "out"),
    socketPath: join(tempDir, ".anakmagang", "events.sock"),
    projectName: "test",
    webSocketPath: join(tempDir, ".anakmagang", "web-events.sock"),
    readConfig: Effect.succeed(""),
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

const mockDirtyBitsLayer = Layer.succeed(
  DirtyBits,
  DirtyBits.of({
    snapshot: () => Effect.succeed([]),
    diff: () => Effect.succeed([]),
    runOnAdvance: () => Effect.void,
  } satisfies DirtyBitsContract),
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
    status: () => Effect.succeed({ total: 0, byType: {}, byScale: {}, byState: {}, bySource: {} }),
  } satisfies MemoryStoreContract),
);

const mockGuardEvaluatorLayer = Layer.succeed(
  GuardEvaluator,
  GuardEvaluator.of({
    evaluate: () => Effect.succeed(Allow()),
    evaluateAll: () => Effect.succeed({ results: [], guards: [] }),
  } satisfies GuardEvaluatorContract),
);

const EventLogLayer = EventLog.bare.pipe(
  Layer.provide(testConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const BaseLayers = Layer.mergeAll(
  MachineLoader.layer,
  testConfigLayer,
  mockMemoryStoreLayer,
  EventLogLayer,
  mockDirtyBitsLayer,
  mockGuardEvaluatorLayer,
  BunServices.layer,
);

const PhaseEngineLayer = PhaseEngine.layer.pipe(
  Layer.provide(BaseLayers),
  Layer.provideMerge(BaseLayers),
);

const BridgeLayers = Bridge.layer.pipe(Layer.provide(EventLogLayer));

const GuardLayers = Layer.mergeAll(EventLogLayer, BridgeLayers, testConfigLayer, BunServices.layer);

const ts = "2026-01-01T00:00:00Z";

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

const makeGuardCtx = (
  guardType: string,
  overrides?: Partial<HookInput>,
): {
  input: HookInput;
  env: HookEnv;
  guard: GuardConfig;
} => ({
  input: {
    tool_name: "Write",
    session_id: "test-session",
    ...overrides,
  },
  env: {
    CLAUDE_PROJECT_DIR: tempDir,
    CLAUDE_AGENT_NAME: "test-worker",
  },
  guard: {
    type: guardType,
    event: "tool_use",
  },
});

const setupSessionId = SessionId(`bench-session-${Date.now()}`);

const setupSession = Effect.gen(function* () {
  const el = yield* EventLog;
  yield* el.createSession(setupSessionId);
  yield* el.appendManifest(setupSessionId, taskStartEvent("bench task", "SMALL"));
  yield* el.appendManifest(setupSessionId, phaseAdvanceEvent("setup", "initial setup"));
});

const setupDone = Effect.runPromise(setupSession.pipe(Effect.provide(EventLogLayer)));

group("EventLog Operations", () => {
  bench("appendManifest — phase_advance", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.appendManifest(setupSessionId, phaseAdvanceEvent("triage", "bench reflection"));
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("currentPhase", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.currentPhase(setupSessionId);
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("currentTask", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.currentTask(setupSessionId);
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("reflections", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.reflections(setupSessionId);
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("observations", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.observations(setupSessionId);
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("listSessions", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.listSessions();
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("iterationCount", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.iterationCount(setupSessionId, "test-agent", "abc123");
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });

  bench("readRawEvents", async () => {
    await setupDone;
    await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.readRawEvents(setupSessionId);
      }).pipe(Effect.provide(EventLogLayer)),
    );
  });
});

group("Config Loading", () => {
  bench("Config.readConfig", async () => {
    const configLayer = Config.layer.pipe(Layer.provideMerge(BunServices.layer));
    await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config;
        yield* config.readConfig;
      }).pipe(Effect.provide(configLayer)),
    );
  });

  bench("Config layer construction", async () => {
    const freshLayer = Config.layer.pipe(Layer.provideMerge(BunServices.layer));
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Config;
      }).pipe(Effect.provide(freshLayer)),
    );
  });
});

group("MachineLoader", () => {
  bench("loadFromFile", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const loader = yield* MachineLoader;
        yield* loader.loadFromFile(configTarget);
      }).pipe(Effect.provide(Layer.mergeAll(MachineLoader.layer, BunServices.layer))),
    );
  });
});

group("Bridge", () => {
  const bridgeSid = SessionId(`bridge-bench-${Date.now()}`);
  const bridgeSetup = Effect.gen(function* () {
    const el = yield* EventLog;
    yield* el.createSession(bridgeSid);
    yield* el.appendManifest(bridgeSid, taskStartEvent("bridge bench task"));
  }).pipe(Effect.provide(EventLogLayer));

  const bridgeReady = Effect.runPromise(bridgeSetup);

  bench("Bridge.upsert", async () => {
    await bridgeReady;
    await Effect.runPromise(
      Effect.gen(function* () {
        const bridge = yield* Bridge;
        yield* bridge.upsert(bridgeSid, "claude", "client-123", { current_task: "bench" });
      }).pipe(Effect.provide(Layer.mergeAll(BridgeLayers, BunServices.layer))),
    );
  });

  bench("Bridge.resolve", async () => {
    await bridgeReady;
    await Effect.runPromise(
      Effect.gen(function* () {
        const bridge = yield* Bridge;
        yield* bridge.resolve("claude", "client-123");
      }).pipe(Effect.provide(Layer.mergeAll(BridgeLayers, BunServices.layer))),
    );
  });

  bench("Bridge.read", async () => {
    await bridgeReady;
    await Effect.runPromise(
      Effect.gen(function* () {
        const bridge = yield* Bridge;
        yield* bridge.read(bridgeSid, "claude", "client-123");
      }).pipe(Effect.provide(Layer.mergeAll(BridgeLayers, BunServices.layer))),
    );
  });
});

group("MemoryStore", () => {
  const memoryLayers = MemoryStore.layer.pipe(
    Layer.provide(testConfigLayer),
    Layer.provideMerge(BunServices.layer),
  );

  bench("MemoryStore.create", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create({
          name: `bench-mem-${Date.now()}`,
          type: "feedback",
          description: "bench memory node",
        });
      }).pipe(Effect.provide(memoryLayers)),
    );
  });

  bench("MemoryStore.list", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.list();
      }).pipe(Effect.provide(memoryLayers)),
    );
  });

  bench("MemoryStore.query", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.query(["bench", "memory"]);
      }).pipe(Effect.provide(memoryLayers)),
    );
  });

  bench("MemoryStore.status", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.status();
      }).pipe(Effect.provide(memoryLayers)),
    );
  });
});

group("GuardEvaluator", () => {
  const evaluatorLayers = GuardEvaluator.bare.pipe(
    Layer.provide(Layer.mergeAll(EventLogLayer, BridgeLayers, testConfigLayer)),
    Layer.provideMerge(BunServices.layer),
  );

  bench("GuardEvaluator.evaluate — agent-first", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        yield* evaluator.evaluate(makeGuardCtx("agent-first"));
      }).pipe(Effect.provide(evaluatorLayers)),
    );
  });

  bench("GuardEvaluator.evaluateAll — chain of guards", async () => {
    const guards: ReadonlyArray<GuardConfig> = [
      { type: "agent-first", event: "tool_use" },
      { type: "output-location", event: "tool_use" },
      { type: "compaction-gate", event: "tool_use" },
      { type: "iteration-limit", event: "tool_use", max: 200, warn_at: 40 },
    ];
    await Effect.runPromise(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        yield* evaluator.evaluateAll(
          guards,
          "tool_use",
          undefined,
          { tool_name: "Write", session_id: "bench-session" },
          { CLAUDE_PROJECT_DIR: tempDir, CLAUDE_AGENT_NAME: "test-worker" },
        );
      }).pipe(Effect.provide(evaluatorLayers)),
    );
  });
});

group("Guards with Dependencies", () => {
  bench("compactionGate — 50% context", async () => {
    await setupDone;
    const ctx = makeGuardCtx("compaction-gate", {
      context_window: { used_percentage: 50 },
    });
    await Effect.runPromise(compactionGate(ctx).pipe(Effect.provide(GuardLayers)));
  });

  bench("iterationLimit — session with iterations", async () => {
    await setupDone;
    const ctx = makeGuardCtx("iteration-limit", {
      session_id: "bench-session",
    });
    const iterCtx = { ...ctx, guard: { ...ctx.guard, max: 200, warn_at: 40 } };
    await Effect.runPromise(iterationLimit(iterCtx).pipe(Effect.provide(GuardLayers)));
  });

  bench("sessionStopGuard — active session", async () => {
    await setupDone;
    const ctx = makeGuardCtx("session-stop-guard", {
      session_id: "bench-session",
    });
    await Effect.runPromise(sessionStopGuard(ctx).pipe(Effect.provide(GuardLayers)));
  });
});

group("PhaseEngine", () => {
  bench("PhaseEngine.start", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        yield* engine.start(`bench-task-${Date.now()}`);
      }).pipe(Effect.provide(PhaseEngineLayer)),
    );
  });

  bench("PhaseEngine.eval", async () => {
    const sid = `eval-bench-${Date.now()}`;
    const setup = Effect.gen(function* () {
      const engine = yield* PhaseEngine;
      const result = yield* engine.start(`eval task ${sid}`);
      return result.sessionId;
    }).pipe(Effect.provide(PhaseEngineLayer));

    const sessionId = await Effect.runPromise(setup);

    await Effect.runPromise(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        yield* engine.eval({
          reflection: "bench reflection for eval",
          sessionId,
          size: "SMALL",
        });
      }).pipe(Effect.provide(PhaseEngineLayer)),
    );
  });

  bench("PhaseEngine.observe", async () => {
    const sid = `observe-bench-${Date.now()}`;
    const setup = Effect.gen(function* () {
      const engine = yield* PhaseEngine;
      const result = yield* engine.start(`observe task ${sid}`);
      return result.sessionId;
    }).pipe(Effect.provide(PhaseEngineLayer));

    const sessionId = await Effect.runPromise(setup);

    await Effect.runPromise(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        yield* engine.observe("bench observation", sessionId);
      }).pipe(Effect.provide(PhaseEngineLayer)),
    );
  });
});
