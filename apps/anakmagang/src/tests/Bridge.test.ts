import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Layer, Option, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { EventLog, type ManifestEvent } from "../EventLog";
import { Config } from "../Config";
import { Bridge } from "../Bridge";
import { Output, silent } from "../protocol.Output";
import { BridgeData } from "../protocol.GuardConfig";
import { SessionId } from "../Ulid";

// Fixtures — realistic bridge event snapshots from different hook events
const fixtures = {
  userPromptSubmit: {
    context_window: { used_percentage: 25 },
    transcript_path: "/Users/r17/.claude/projects/test/abc.jsonl",
    last_seen: "2026-01-01T00:00:00Z",
  },
  statusLine: {
    context_window: { used_percentage: 38 },
    last_seen: "2026-01-01T00:01:00Z",
    current_task: "Implement Bridge module",
    current_phase: "implementation",
  },
  preToolUse: {
    context_window: { used_percentage: 42 },
    last_seen: "2026-01-01T00:02:00Z",
  },
  statusLineHighContext: {
    context_window: { used_percentage: 78 },
    last_seen: "2026-01-01T00:10:00Z",
    current_task: "Implement Bridge module",
    current_phase: "testing",
  },
  minimalHeartbeat: {
    last_seen: "2026-01-01T00:05:00Z",
  },
} as const;

const tempDir = mkdtempSync(join(tmpdir(), "bridge-test-"));

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

const BridgeLayer = Bridge.layer.pipe(Layer.provideMerge(EventLogLayer));

const TestLayer = Layer.mergeAll(Output.withFormat(silent), BridgeLayer, BunServices.layer);

const run = <A, E>(effect: Effect.Effect<A, E, Bridge | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

const cleanup = (sid: SessionId) =>
  run(
    Effect.gen(function* () {
      const eventLog = yield* EventLog;
      yield* eventLog.removeSession(sid).pipe(Effect.orElseSucceed(() => void 0));
    }),
  );

const ts = "2026-01-01T00:00:00Z";

const taskStartEvent = (task: string): ManifestEvent => ({
  type: "task_start",
  task,
  ts,
});

const phaseAdvanceEvent = (phase: string, reflection: string): ManifestEvent => ({
  type: "phase_advance",
  phase,
  reflection,
  ts,
});

const setupActiveSession = (sid: SessionId, task: string) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    yield* eventLog.createSession(sid);
    yield* eventLog.appendManifest(sid, taskStartEvent(task));
    yield* eventLog.appendManifest(sid, { type: "session_init" as const, phase: "setup", ts });
    yield* eventLog.appendManifest(sid, phaseAdvanceEvent("setup", "test setup"));
  });

const setupCompletedSession = (sid: SessionId) =>
  Effect.gen(function* () {
    const eventLog = yield* EventLog;
    yield* eventLog.createSession(sid);
    yield* eventLog.appendManifest(sid, taskStartEvent("completed task"));
    yield* eventLog.appendManifest(sid, { type: "session_init" as const, phase: "setup", ts });
    yield* eventLog.appendManifest(sid, phaseAdvanceEvent("completion", "reflecting"));
    yield* eventLog.appendManifest(sid, phaseAdvanceEvent("completion", "all done"));
  });

describe("Bridge.upsert", () => {
  test("creates bridge file with single event", async () => {
    const sid = SessionId("session-upsert-single");
    await run(setupActiveSession(sid, "single event test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-single", fixtures.userPromptSubmit);
          const data = yield* bridge.read(sid, "claude", "client-single");
          const d = Option.getOrThrow(data);
          expect(d.last_seen).toBe("2026-01-01T00:00:00Z");
          expect(d.transcript_path).toBe("/Users/r17/.claude/projects/test/abc.jsonl");
          expect(d.context_window?.used_percentage).toBe(25);
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("appends multiple events verified via raw EventLog readJson", async () => {
    const sid = SessionId("session-upsert-append");
    await run(setupActiveSession(sid, "append test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          const eventLog = yield* EventLog;
          yield* bridge.upsert(sid, "claude", "client-append", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "claude", "client-append", fixtures.statusLine);
          yield* bridge.upsert(sid, "claude", "client-append", fixtures.preToolUse);

          const raw = yield* eventLog.readJson(
            sid,
            "claude",
            "client-append",
            Schema.Array(BridgeData),
          );
          expect(raw).toBeDefined();
          if (!raw) return;
          expect(raw.length).toBe(3);
          expect(raw[0]?.last_seen).toBe("2026-01-01T00:00:00Z");
          expect(raw[1]?.last_seen).toBe("2026-01-01T00:01:00Z");
          expect(raw[2]?.last_seen).toBe("2026-01-01T00:02:00Z");
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("works for multiple clients on same session", async () => {
    const sid = SessionId("session-upsert-multi-client");
    await run(setupActiveSession(sid, "multi client test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "c1", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "opencode", "o1", fixtures.statusLine);
          const claudeData = Option.getOrThrow(yield* bridge.read(sid, "claude", "c1"));
          const opencodeData = Option.getOrThrow(yield* bridge.read(sid, "opencode", "o1"));
          expect(claudeData.last_seen).toBe("2026-01-01T00:00:00Z");
          expect(opencodeData.last_seen).toBe("2026-01-01T00:01:00Z");
          expect(opencodeData.current_task).toBe("Implement Bridge module");
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });
});

describe("Bridge.read", () => {
  test("returns None for nonexistent bridge", async () => {
    const sid = SessionId("session-read-none");
    await run(setupActiveSession(sid, "read none test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          const data = yield* bridge.read(sid, "claude", "nonexistent-client");
          expect(Option.isNone(data)).toBe(true);
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("single event returns that event", async () => {
    const sid = SessionId("session-read-single");
    await run(setupActiveSession(sid, "read single test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-read-single", fixtures.statusLine);
          const d = Option.getOrThrow(yield* bridge.read(sid, "claude", "client-read-single"));
          expect(d.last_seen).toBe("2026-01-01T00:01:00Z");
          expect(d.current_task).toBe("Implement Bridge module");
          expect(d.current_phase).toBe("implementation");
          expect(d.context_window?.used_percentage).toBe(38);
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("reduction across heterogeneous events merges all fields", async () => {
    const sid = SessionId("session-read-hetero");
    await run(setupActiveSession(sid, "heterogeneous reduction"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-hetero", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "claude", "client-hetero", fixtures.statusLine);
          yield* bridge.upsert(sid, "claude", "client-hetero", fixtures.preToolUse);
          const d = Option.getOrThrow(yield* bridge.read(sid, "claude", "client-hetero"));
          expect(d.transcript_path).toBe("/Users/r17/.claude/projects/test/abc.jsonl");
          expect(d.current_task).toBe("Implement Bridge module");
          expect(d.current_phase).toBe("implementation");
          expect(d.context_window?.used_percentage).toBe(42);
          expect(d.last_seen).toBe("2026-01-01T00:02:00Z");
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("reduction preserves latest non-undefined values", async () => {
    const sid = SessionId("session-read-latest");
    await run(setupActiveSession(sid, "latest wins"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-latest", fixtures.statusLine);
          yield* bridge.upsert(sid, "claude", "client-latest", fixtures.statusLineHighContext);
          const d = Option.getOrThrow(yield* bridge.read(sid, "claude", "client-latest"));
          expect(d.context_window?.used_percentage).toBe(78);
          expect(d.current_phase).toBe("testing");
          expect(d.current_task).toBe("Implement Bridge module");
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("minimal heartbeat does not clobber existing fields", async () => {
    const sid = SessionId("session-read-heartbeat");
    await run(setupActiveSession(sid, "heartbeat no clobber"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-heartbeat", fixtures.statusLine);
          yield* bridge.upsert(sid, "claude", "client-heartbeat", fixtures.minimalHeartbeat);
          const d = Option.getOrThrow(yield* bridge.read(sid, "claude", "client-heartbeat"));
          expect(d.current_task).toBe("Implement Bridge module");
          expect(d.current_phase).toBe("implementation");
          expect(d.context_window?.used_percentage).toBe(38);
          expect(d.last_seen).toBe("2026-01-01T00:05:00Z");
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });
});

describe("Bridge.resolve", () => {
  test("finds active session", async () => {
    const sid = SessionId("session-resolve-active");
    await run(setupActiveSession(sid, "resolve test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-resolve-active", fixtures.userPromptSubmit);
          const resolved = yield* bridge.resolve("claude", "client-resolve-active");
          expect(resolved).toEqual(Option.some(sid));
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("returns None for nonexistent client", async () => {
    await run(
      Effect.gen(function* () {
        const bridge = yield* Bridge;
        const resolved = yield* bridge.resolve("claude", "nonexistent-client-xyz");
        expect(Option.isNone(resolved)).toBe(true);
      }),
    );
  });

  test("returns None for completed session", async () => {
    const sid = SessionId("session-resolve-completed");
    await run(setupCompletedSession(sid));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(
            sid,
            "claude",
            "client-resolve-completed",
            fixtures.userPromptSubmit,
          );
          const resolved = yield* bridge.resolve("claude", "client-resolve-completed");
          expect(Option.isNone(resolved)).toBe(true);
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("picks active session when multiple exist", async () => {
    const sidCompleted = SessionId("session-resolve-multi-a");
    const sidActive = SessionId("session-resolve-multi-b");
    await run(setupCompletedSession(sidCompleted));
    await run(setupActiveSession(sidActive, "active task"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(
            sidCompleted,
            "claude",
            "client-resolve-multi",
            fixtures.userPromptSubmit,
          );
          yield* bridge.upsert(sidActive, "claude", "client-resolve-multi", fixtures.statusLine);
          const resolved = yield* bridge.resolve("claude", "client-resolve-multi");
          expect(resolved).toEqual(Option.some(sidActive));
        }),
      );
    } finally {
      await cleanup(sidCompleted);
      await cleanup(sidActive);
    }
  });
});

describe("Bridge multi-client isolation", () => {
  test("two clients on same session resolve independently", async () => {
    const sid = SessionId("session-isolation-same");
    await run(setupActiveSession(sid, "isolation test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "claude-iso", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "opencode", "opencode-iso", fixtures.statusLine);
          const claudeResolved = yield* bridge.resolve("claude", "claude-iso");
          const opencodeResolved = yield* bridge.resolve("opencode", "opencode-iso");
          expect(claudeResolved).toEqual(Option.some(sid));
          expect(opencodeResolved).toEqual(Option.some(sid));
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("same clientSid on different sessions resolve to correct ones", async () => {
    const sidA = SessionId("session-isolation-a");
    const sidB = SessionId("session-isolation-b");
    await run(setupCompletedSession(sidA));
    await run(setupActiveSession(sidB, "active session b"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sidA, "claude", "shared-client-sid", fixtures.userPromptSubmit);
          yield* bridge.upsert(sidB, "claude", "shared-client-sid", fixtures.statusLine);
          const resolved = yield* bridge.resolve("claude", "shared-client-sid");
          expect(resolved).toEqual(Option.some(sidB));
        }),
      );
    } finally {
      await cleanup(sidA);
      await cleanup(sidB);
    }
  });
});

describe("Bridge single-owner", () => {
  test("upsert from new client removes previous client bridge", async () => {
    const sid = SessionId("session-single-owner");
    await run(setupActiveSession(sid, "single owner test"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          const eventLog = yield* EventLog;
          yield* bridge.upsert(sid, "claude", "client-A", fixtures.userPromptSubmit);
          expect(Option.isSome(yield* bridge.resolve("claude", "client-A"))).toBe(true);

          yield* bridge.upsert(sid, "claude", "client-B", fixtures.statusLine);
          expect(Option.isSome(yield* bridge.resolve("claude", "client-B"))).toBe(true);
          expect(Option.isNone(yield* bridge.resolve("claude", "client-A"))).toBe(true);

          const aData = yield* eventLog.readJson(
            sid,
            "claude",
            "client-A",
            Schema.Array(BridgeData),
          );
          expect(aData).toBeUndefined();
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("upsert from same client does not remove own bridge", async () => {
    const sid = SessionId("session-single-owner-same");
    await run(setupActiveSession(sid, "same client upsert"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "client-same", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "claude", "client-same", fixtures.statusLine);
          const data = yield* bridge.read(sid, "claude", "client-same");
          expect(Option.isSome(data)).toBe(true);
          const d = Option.getOrThrow(data);
          expect(d.current_task).toBe("Implement Bridge module");
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("different providers are independent — claude and opencode coexist", async () => {
    const sid = SessionId("session-single-owner-multi-provider");
    await run(setupActiveSession(sid, "multi provider"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "claude-session", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "opencode", "opencode-session", fixtures.statusLine);
          expect(Option.isSome(yield* bridge.resolve("claude", "claude-session"))).toBe(true);
          expect(Option.isSome(yield* bridge.resolve("opencode", "opencode-session"))).toBe(true);
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });

  test("three-way teleport: A → B → C, only C remains", async () => {
    const sid = SessionId("session-single-owner-teleport");
    await run(setupActiveSession(sid, "teleport chain"));
    try {
      await run(
        Effect.gen(function* () {
          const bridge = yield* Bridge;
          yield* bridge.upsert(sid, "claude", "session-A", fixtures.userPromptSubmit);
          yield* bridge.upsert(sid, "claude", "session-B", fixtures.statusLine);
          yield* bridge.upsert(sid, "claude", "session-C", fixtures.preToolUse);

          expect(Option.isNone(yield* bridge.resolve("claude", "session-A"))).toBe(true);
          expect(Option.isNone(yield* bridge.resolve("claude", "session-B"))).toBe(true);
          expect(Option.isSome(yield* bridge.resolve("claude", "session-C"))).toBe(true);
        }),
      );
    } finally {
      await cleanup(sid);
    }
  });
});
