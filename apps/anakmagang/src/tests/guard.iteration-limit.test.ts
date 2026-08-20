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
import { BridgeData, hashString } from "../protocol.GuardConfig";
import { SessionId } from "../Ulid";
import { Output, silent } from "../protocol.Output";

const tempDir = mkdtempSync(join(tmpdir(), "guard-iteration-limit-test-"));

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

const claudeSid = "test-claude-iteration-limit";

const guard: GuardConfig = { type: "iteration-limit", event: "PreToolUse", matcher: "Bash" };

const envWithAgent: HookEnv = {
  CLAUDE_PROJECT_DIR: "/tmp/test-project",
  CLAUDE_AGENT_NAME: "test-worker",
};

const envNoAgent: HookEnv = {
  CLAUDE_PROJECT_DIR: "/tmp/test-project",
};

const makeInput = (): HookInput => ({ tool_name: "Bash", session_id: claudeSid });

const setupSession = (label: string, opts?: { taskName?: string }) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const sid = SessionId(`session-iterlim-${label}`);
    const task = opts?.taskName ?? "test task";

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

    return sid;
  });

const populateIterations = (sid: SessionId, count: number, agent: string, taskName: string) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const taskHash = hashString(taskName);
    for (let i = 0; i < count; i++) {
      yield* eventLog.appendLog(sid, {
        type: "iteration",
        agent,
        task_hash: taskHash,
        ts: new Date().toISOString(),
      });
    }
  });

describe("iteration-limit guard", () => {
  beforeEach(async () => {
    await cleanupAllTestSessions();
  });

  afterEach(async () => {
    await cleanupAllTestSessions();
  });

  // --- Allow cases ---

  test("no CLAUDE_AGENT_NAME in env -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Bash", session_id: claudeSid };
        return yield* evaluator.evaluate({ input, env: envNoAgent, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("empty CLAUDE_AGENT_NAME -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Bash", session_id: claudeSid };
        const env: HookEnv = { CLAUDE_PROJECT_DIR: "/tmp/test-project", CLAUDE_AGENT_NAME: "  " };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("no session_id -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Bash" };
        return yield* evaluator.evaluate({ input, env: envWithAgent, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("session_id but no bridge and no active session -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(), env: envWithAgent, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("active session, no task -> Allow", async () => {
    const sid = SessionId(`session-iterlim-notask`);
    await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.writeJson(
          sid,
          "claude",
          claudeSid,
          {
            last_seen: new Date().toISOString(),
          },
          BridgeData,
        );
      }),
    );
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(), env: envWithAgent, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("first tool call -> Allow", async () => {
    const sid = await run(setupSession("first-call"));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(), env: envWithAgent, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  // --- Warn cases ---

  test("at warn threshold (40 calls) -> Warn", async () => {
    const sid = await run(setupSession("warn-40"));
    try {
      await run(populateIterations(sid, 39, "test-worker", "test task"));
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(), env: envWithAgent, guard });
        }),
      );
      expect($is("Warn")(result)).toBe(true);
      if ($is("Warn")(result)) {
        expect(result.message).toContain("test-worker");
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("custom warn_at -> Warn", async () => {
    const sid = await run(setupSession("warn-custom"));
    try {
      await run(populateIterations(sid, 4, "test-worker", "test task"));
      const customGuard: GuardConfig = { ...guard, warn_at: 5 };
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({
            input: makeInput(),
            env: envWithAgent,
            guard: customGuard,
          });
        }),
      );
      expect($is("Warn")(result)).toBe(true);
      if ($is("Warn")(result)) {
        expect(result.message).toContain("test-worker");
      }
    } finally {
      await cleanup(sid);
    }
  });

  // --- Block cases ---

  test("at max threshold (200 calls) -> Block", async () => {
    const sid = await run(setupSession("block-200"));
    try {
      await run(populateIterations(sid, 199, "test-worker", "test task"));
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(), env: envWithAgent, guard });
        }),
      );
      expect($is("Block")(result)).toBe(true);
      if ($is("Block")(result)) {
        expect(result.message).toContain("test-worker");
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("custom max -> Block", async () => {
    const sid = await run(setupSession("block-custom"));
    try {
      await run(populateIterations(sid, 9, "test-worker", "test task"));
      const customGuard: GuardConfig = { ...guard, max: 10, warn_at: 5 };
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({
            input: makeInput(),
            env: envWithAgent,
            guard: customGuard,
          });
        }),
      );
      expect($is("Block")(result)).toBe(true);
      if ($is("Block")(result)) {
        expect(result.message).toContain("test-worker");
      }
    } finally {
      await cleanup(sid);
    }
  });

  // --- Count reading ---

  test("guard reads iteration count from Middleware-resolved current", async () => {
    const sid = await run(setupSession("read-count"));
    try {
      await run(populateIterations(sid, 10, "test-worker", "test task"));
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(), env: envWithAgent, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  // --- Fallback cases (no bridge mapping, active session found via EventLog) ---

  test("fallback: active session without bridge -> counts iterations", async () => {
    const unbridgedClaudeSid = "unbridged-claude-iteration";
    const sid = SessionId("session-iterlim-fallback");
    const taskName = "fallback iteration task";
    await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "task_start",
          task: taskName,
          ts: new Date().toISOString(),
        });
      }),
    );
    try {
      const input: HookInput = { tool_name: "Bash", session_id: unbridgedClaudeSid };
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input, env: envWithAgent, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("fallback: active session without bridge at warn threshold -> Allow (no bridge = no session resolved)", async () => {
    const unbridgedClaudeSid = "unbridged-claude-iteration-warn";
    const sid = SessionId("session-iterlim-fallback-warn");
    const taskName = "fallback warn task";
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
      }),
    );
    try {
      await run(populateIterations(sid, 39, "test-worker", taskName));
      const input: HookInput = { tool_name: "Bash", session_id: unbridgedClaudeSid };
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input, env: envWithAgent, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });
});
