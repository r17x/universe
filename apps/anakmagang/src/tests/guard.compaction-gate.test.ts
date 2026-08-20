import { describe, test, expect, afterAll } from "bun:test";
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
import { SessionId } from "../Ulid";
import { Output, silent } from "../protocol.Output";

const tempDir = mkdtempSync(join(tmpdir(), "guard-compaction-gate-test-"));

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

const claudeSid = "test-claude-compaction";

const guard: GuardConfig = { type: "compaction-gate", event: "PreToolUse", matcher: "Agent" };

const makeInput = (pct?: number | null): HookInput => ({
  tool_name: "Agent",
  session_id: claudeSid,
  ...(pct !== undefined ? { context_window: { used_percentage: pct } } : {}),
});

/** Create a session so resolveSession can find it for teleport messages */
const setupSession = (label: string) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    const sid = SessionId(`session-compaction-${label}`);

    yield* eventLog.createSession(sid);
    yield* eventLog.appendManifest(sid, {
      type: "task_start",
      task: "test task",
      ts: new Date().toISOString(),
    });
    yield* eventLog.appendManifest(sid, {
      type: "session_init" as const,
      phase: "setup",
      ts: new Date().toISOString(),
    });

    // Write bridge so resolveSession can map claudeSid -> anakmagangSid
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

const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

const cleanup = (sid: SessionId) =>
  run(
    Effect.gen(function* () {
      const eventLog = yield* EventLog;
      yield* eventLog.removeSession(sid).pipe(Effect.orElseSucceed(() => void 0));
    }),
  );

describe("compaction-gate guard", () => {
  // --- Allow cases ---

  test("no session_id -> Allow (with low pct)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Agent", context_window: { used_percentage: 10 } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("no context_window, no active session -> Allow (cold start)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Agent", session_id: claudeSid };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("context_window at 50% -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(50), env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("context_window at 0% -> Allow", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(0), env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("context_window at 60% exactly -> Allow (threshold is >60 for warn)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(60), env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("context_window.used_percentage = null, no active session -> Allow (cold start)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(null), env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  // --- Warn cases ---

  test("no context_window, active session -> Warn", async () => {
    const sid = await run(setupSession("no-ctx-active"));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const input: HookInput = { tool_name: "Agent", session_id: claudeSid };
          return yield* evaluator.evaluate({ input, env, guard });
        }),
      );
      expect($is("Warn")(result)).toBe(true);
      if ($is("Warn")(result)) {
        expect(result.message).toContain("unknown");
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("context_window at 65% -> Warn", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(65), env, guard });
      }),
    );
    expect($is("Warn")(result)).toBe(true);
  });

  test("context_window at 70% -> Warn", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(70), env, guard });
      }),
    );
    expect($is("Warn")(result)).toBe(true);
  });

  test("context_window at 75% exactly -> Warn (threshold is >75 for block)", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(75), env, guard });
      }),
    );
    expect($is("Warn")(result)).toBe(true);
  });

  test("Warn message includes percentage", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(65), env, guard });
      }),
    );
    expect($is("Warn")(result)).toBe(true);
    if ($is("Warn")(result)) {
      expect(result.message).toContain("65%");
    }
  });

  test("Warn message includes session ID when session exists", async () => {
    const sid = await run(setupSession("warn-msg-sid"));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(65), env, guard });
        }),
      );
      expect($is("Warn")(result)).toBe(true);
      if ($is("Warn")(result)) {
        expect(result.message).toContain(sid);
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("Warn without session still produces message", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        // No session_id at all
        const input: HookInput = { tool_name: "Agent", context_window: { used_percentage: 65 } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Warn")(result)).toBe(true);
    if ($is("Warn")(result)) {
      expect(result.message).toContain("65%");
      expect(result.message).toContain("Context window filling up");
    }
  });

  // --- Block cases ---

  test("context_window at 81% -> Block", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(81), env, guard });
      }),
    );
    expect($is("Block")(result)).toBe(true);
  });

  test("context_window at 90% -> Block", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(90), env, guard });
      }),
    );
    expect($is("Block")(result)).toBe(true);
  });

  test("context_window at 100% -> Block", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(100), env, guard });
      }),
    );
    expect($is("Block")(result)).toBe(true);
  });

  test("Block message includes percentage", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input: makeInput(85), env, guard });
      }),
    );
    expect($is("Block")(result)).toBe(true);
    if ($is("Block")(result)) {
      expect(result.message).toContain("85%");
    }
  });

  test("Block message includes session ID when session exists", async () => {
    const sid = await run(setupSession("block-msg-sid"));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          return yield* evaluator.evaluate({ input: makeInput(95), env, guard });
        }),
      );
      expect($is("Block")(result)).toBe(true);
      if ($is("Block")(result)) {
        expect(result.message).toContain(sid);
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("Block without session still produces message", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Agent", context_window: { used_percentage: 85 } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Block")(result)).toBe(true);
    if ($is("Block")(result)) {
      expect(result.message).toContain("85%");
      expect(result.message).toContain("Start a new conversation");
    }
  });

  // --- Bridge fallback cases ---

  const setupSessionWithBridge = (label: string, contextPct?: number | null) =>
    Effect.gen(function* () {
      const eventLog = yield* EventLog;
      const sid = SessionId(`session-compaction-bridge-${label}`);

      yield* eventLog.createSession(sid);
      yield* eventLog.appendManifest(sid, {
        type: "task_start",
        task: "test task",
        ts: new Date().toISOString(),
      });
      yield* eventLog.appendManifest(sid, {
        type: "session_init" as const,
        phase: "setup",
        ts: new Date().toISOString(),
      });

      const bridgeEntry: Record<string, unknown> = {
        last_seen: new Date().toISOString(),
      };
      if (contextPct !== undefined) {
        bridgeEntry.context_window = { used_percentage: contextPct };
      }

      yield* eventLog.writeJson(sid, "claude", claudeSid, [bridgeEntry], Schema.Array(BridgeData));
      return sid;
    });

  test("falls back to Bridge when stdin has no context_window", async () => {
    const sid = await run(setupSessionWithBridge("fallback-allow", 50));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const input: HookInput = { tool_name: "Agent", session_id: claudeSid };
          return yield* evaluator.evaluate({ input, env, guard });
        }),
      );
      expect($is("Allow")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("falls back to Bridge and blocks at high usage", async () => {
    const sid = await run(setupSessionWithBridge("fallback-block", 85));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const input: HookInput = { tool_name: "Agent", session_id: claudeSid };
          return yield* evaluator.evaluate({ input, env, guard });
        }),
      );
      expect($is("Block")(result)).toBe(true);
    } finally {
      await cleanup(sid);
    }
  });

  test("falls back to Bridge and warns at medium usage", async () => {
    const sid = await run(setupSessionWithBridge("fallback-warn", 65));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const input: HookInput = { tool_name: "Agent", session_id: claudeSid };
          return yield* evaluator.evaluate({ input, env, guard });
        }),
      );
      expect($is("Warn")(result)).toBe(true);
      if ($is("Warn")(result)) {
        expect(result.message).toContain("65%");
      }
    } finally {
      await cleanup(sid);
    }
  });

  test("Warn when Bridge also has no context_window", async () => {
    const sid = await run(setupSessionWithBridge("fallback-no-ctx"));
    try {
      const result = await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const input: HookInput = { tool_name: "Agent", session_id: claudeSid };
          return yield* evaluator.evaluate({ input, env, guard });
        }),
      );
      expect($is("Warn")(result)).toBe(true);
      if ($is("Warn")(result)) {
        expect(result.message).toContain("unknown");
      }
    } finally {
      await cleanup(sid);
    }
  });
});
