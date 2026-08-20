import { describe, test, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { GuardEvaluator, $is, type GuardConfig, type HookInput, type HookEnv } from "../guard";
import { EventLog } from "../EventLog";
import { Config } from "../Config";
import { Bridge } from "../Bridge";
import { BridgeData } from "../protocol.GuardConfig";
import { Output, silent } from "../protocol.Output";
import { SessionId } from "../Ulid";

const tempDir = mkdtempSync(join(tmpdir(), "guard-session-stop-test-"));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const testConfigLayer = Layer.succeed(
  Config,
  Config.of({
    root: tempDir,
    configPath: join(tempDir, "config.yaml"),
    outDir: join(tempDir, "out"),
    socketPath: join(tempDir, ".anakmagang", "events.sock"),
    projectName: "test",
    webSocketPath: join(tempDir, ".anakmagang", "web-events.sock"),
    readConfig: Effect.die("not used in tests"),
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

const TestLayer = GuardEvaluator.bare.pipe(
  Layer.provide(Bridge.layer),
  Layer.provide(testConfigLayer),
  Layer.provideMerge(EventLogLayer),
  Layer.provideMerge(Output.withFormat(silent)),
  Layer.provideMerge(BunServices.layer),
);

const env: HookEnv = {
  CLAUDE_PROJECT_DIR: "/tmp/test-project",
};

const claudeSid = "test-claude-session-stop";

const guard: GuardConfig = { type: "session-stop-guard", event: "Stop" };

const makeInput = (sessionId?: string): HookInput => ({
  tool_name: "",
  ...(sessionId ? { session_id: sessionId } : {}),
});

const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

const cleanup = (sid: SessionId) =>
  run(
    Effect.gen(function* () {
      const eventLog = yield* EventLog;
      yield* eventLog.removeSession(sid).pipe(Effect.orElseSucceed(() => void 0));
    }),
  );

const cleanupAllTestSessions = () =>
  run(
    Effect.gen(function* () {
      const eventLog = yield* EventLog;
      const sessions = yield* eventLog.listSessions();
      yield* Effect.forEach(sessions, (sid) =>
        eventLog.removeSession(sid).pipe(Effect.orElseSucceed(() => void 0)),
      );
    }),
  );

const setupActiveSession = (sid: SessionId, task: string) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    yield* eventLog.createSession(sid);
    yield* eventLog.appendManifest(sid, {
      type: "task_start",
      task,
      ts: new Date().toISOString(),
    });
    yield* eventLog.appendManifest(sid, {
      type: "session_init" as const,
      phase: "setup",
      ts: new Date().toISOString(),
    });
    yield* eventLog.appendManifest(sid, {
      type: "phase_advance",
      phase: "setup",
      reflection: "test setup",
      ts: new Date().toISOString(),
    });
    yield* eventLog.writeJson(
      sid,
      "claude",
      claudeSid,
      [
        {
          last_seen: new Date().toISOString(),
        },
      ],
      Schema.Array(BridgeData),
    );
  });

const setupCompletedSession = (sid: SessionId) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    yield* eventLog.createSession(sid);
    yield* eventLog.appendManifest(sid, {
      type: "task_start",
      task: "completed task",
      ts: new Date().toISOString(),
    });
    yield* eventLog.appendManifest(sid, {
      type: "session_init" as const,
      phase: "setup",
      ts: new Date().toISOString(),
    });
    yield* eventLog.appendManifest(sid, {
      type: "phase_advance",
      phase: "completion",
      reflection: "all done",
      ts: new Date().toISOString(),
    });
    yield* eventLog.writeJson(
      sid,
      "claude",
      claudeSid,
      [
        {
          last_seen: new Date().toISOString(),
        },
      ],
      Schema.Array(BridgeData),
    );
  });

describe("session-stop-guard", () => {
  beforeEach(async () => {
    await cleanupAllTestSessions();
  });

  afterEach(async () => {
    await cleanupAllTestSessions();
  });

  // --- Allow cases ---

  test("no session_id -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(), env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("session_id but no bridge mapping and no active session -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("session_id with completed session -> Allow", async () => {
    const sid = SessionId("session-sesstop-allow-completed");
    await run(setupCompletedSession(sid));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  // --- Info cases ---

  test("active session with task -> Info", async () => {
    const sid = SessionId("session-sesstop-block-active");
    const taskName = "implement feature X";
    await run(setupActiveSession(sid, taskName));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Info")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("Info message contains task name", async () => {
    const sid = SessionId("session-sesstop-block-taskname");
    const taskName = "refactor guard system";
    await run(setupActiveSession(sid, taskName));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Info")(result)).toBe(true);
      if ($is("Info")(result)) {
        expect(result.message).toContain(taskName);
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("Info message contains phase when session has phase_advance", async () => {
    const sid = SessionId("session-sesstop-block-phase");
    const taskName = "add tests for guards";
    await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "task_start",
          task: taskName,
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "session_init" as const,
          phase: "setup",
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "phase_advance",
          phase: "triage",
          reflection: "triaging now",
          ts: new Date().toISOString(),
        });
        yield* eventLog.writeJson(
          sid,
          "claude",
          claudeSid,
          [
            {
              last_seen: new Date().toISOString(),
            },
          ],
          Schema.Array(BridgeData),
        );
      }),
    );
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Info")(result)).toBe(true);
      if ($is("Info")(result)) {
        expect(result.message).toContain("Phase:");
        expect(result.message).toContain("triage");
      }
    } finally {
      await cleanup(sid);
    }
  });

  // --- Fallback cases (no bridge mapping, active session found via EventLog) ---

  test("emits Info repeatedly on active session (no escape hatch)", async () => {
    const sid = SessionId("session-sesstop-no-escape");
    const taskName = "persistent info test";
    await run(setupActiveSession(sid, taskName));
    try {
      const result1 = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Info")(result1)).toBe(true);

      await run(
        Effect.gen(function* () {
          const eventLog = yield* EventLog;
          yield* eventLog.appendManifest(sid, {
            type: "guard_fired" as const,
            guard: "session-stop-guard",
            decision: "info",
            ts: new Date().toISOString(),
          });
        }),
      );

      const result2 = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Info")(result2)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("fallback: active session without bridge mapping -> Allow", async () => {
    const sid = SessionId("session-sesstop-fallback-block");
    const taskName = "fallback test task";
    const unbridgedClaudeSid = "unbridged-claude-session-stop";
    await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "task_start",
          task: taskName,
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "session_init" as const,
          phase: "setup",
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "phase_advance",
          phase: "setup",
          reflection: "test setup",
          ts: new Date().toISOString(),
        });
      }),
    );
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(unbridgedClaudeSid), env, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("EventLog errors -> Info (fail-closed)", async () => {
    const sid = SessionId("session-sesstop-fail-closed");
    const taskName = "fail-closed test";
    await run(setupActiveSession(sid, taskName));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(claudeSid), env, guard });
        }),
      );
      expect($is("Info")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("fallback: draft session without bridge mapping -> Allow", async () => {
    const sid = SessionId("session-sesstop-fallback-draft");
    const unbridgedClaudeSid = "unbridged-claude-session-stop-draft";
    await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "task_start",
          task: "draft task",
          ts: new Date().toISOString(),
        });
      }),
    );
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(unbridgedClaudeSid), env, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });
});
