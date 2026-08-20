import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { EventLog, type ManifestEvent, type LogEvent } from "../EventLog";
import { Config } from "../Config";
import { SessionId } from "../Ulid";

const tempDir = mkdtempSync(join(tmpdir(), "eventlog-test-"));

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
    projectName: "test-project",
    webSocketPath: join(tempDir, ".anakmagang", "events.sock"),
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

const testLayers = EventLog.bare.pipe(
  Layer.provide(testConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const run = <A, E>(effect: Effect.Effect<A, E, EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayers)));

const ts = "2026-01-01T00:00:00Z";

const taskStartEvent = (task: string, size?: string): ManifestEvent => ({
  type: "task_start",
  task,
  ...(size !== undefined ? { size } : {}),
  ts,
});

const phaseAdvanceEvent = (
  phase: string,
  reflection: string,
  next_phase?: string,
): ManifestEvent => ({
  type: "phase_advance",
  phase,
  reflection,
  ...(next_phase !== undefined ? { next_phase } : {}),
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

describe("EventLog session lifecycle", () => {
  test("createSession creates session directory", async () => {
    const sid = SessionId(`session-create-${Date.now()}`);
    await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
      }),
    );
    const { existsSync } = await import("fs");
    expect(existsSync(join(tempDir, "out", sid))).toBe(true);
  });

  test("listSessions returns session IDs", async () => {
    const sid1 = SessionId(`session-list-a-${Date.now()}`);
    const sid2 = SessionId(`session-list-b-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid1);
        yield* el.createSession(sid2);
        return yield* el.listSessions();
      }),
    );
    expect(result).toContain(sid1);
    expect(result).toContain(sid2);
  });

  test("listSessions returns empty array when outDir does not exist", async () => {
    const emptyTmp = mkdtempSync(join(tmpdir(), "eventlog-empty-"));
    const emptyConfigLayer = Layer.succeed(
      Config,
      Config.of({
        root: emptyTmp,
        configPath: join(emptyTmp, "config.yaml"),
        outDir: join(emptyTmp, "out-nonexistent"),
        socketPath: join(emptyTmp, ".anakmagang", "events.sock"),
        projectName: "test-project",
        webSocketPath: join(emptyTmp, ".anakmagang", "events.sock"),
        readConfig: Effect.die("not used"),
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
    const emptyLayers = EventLog.bare.pipe(
      Layer.provide(emptyConfigLayer),
      Layer.provideMerge(BunServices.layer),
    );
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        return yield* el.listSessions();
      }).pipe(Effect.provide(emptyLayers)),
    );
    expect(result).toEqual([]);
    rmSync(emptyTmp, { recursive: true, force: true });
  });

  test("removeSession removes session directory", async () => {
    const sid = SessionId(`session-remove-${Date.now()}`);
    await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.removeSession(sid);
      }),
    );
    const { existsSync } = await import("fs");
    expect(existsSync(join(tempDir, "out", sid))).toBe(false);
  });

  test("removeSession on non-existent session throws EventLogError", async () => {
    const sid = SessionId(`session-remove-nonexistent-${Date.now()}`);
    const promise = run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.removeSession(sid);
      }),
    );
    await expect(promise).rejects.toThrow();
  });
});

describe("EventLog manifest operations", () => {
  test("appendManifest writes task_start event correctly", async () => {
    const sid = SessionId(`session-append-start-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("my task"));
        return yield* el.readRawEvents(sid);
      }),
    );
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("task_start");
    expect(result[0]["task"]).toBe("my task");
  });

  test("appendManifest appends multiple events in order", async () => {
    const sid = SessionId(`session-append-multi-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("task1"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("setup", "reflected on setup"));
        yield* el.appendManifest(sid, observationEvent("observed something"));
        return yield* el.readRawEvents(sid);
      }),
    );
    expect(result.length).toBe(3);
    expect(result[0].type).toBe("task_start");
    expect(result[1].type).toBe("phase_advance");
    expect(result[2].type).toBe("observation");
  });

  test("readRawEvents reads back what was written", async () => {
    const sid = SessionId(`session-readraw-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("round-trip task"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("triage", "triaging"));
        return yield* el.readRawEvents(sid);
      }),
    );
    expect(result[0]["task"]).toBe("round-trip task");
    expect(result[1]["phase"]).toBe("triage");
    expect(result[1]["reflection"]).toBe("triaging");
  });

  test("readRawEvents on empty session returns empty array", async () => {
    const sid = SessionId(`session-readraw-empty-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        return yield* el.readRawEvents(sid);
      }),
    );
    expect(result).toEqual([]);
  });
});

describe("EventLog state queries", () => {
  test("isActive returns true after session_init", async () => {
    const sid = SessionId(`session-active-true-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("active task"));
        yield* el.appendManifest(sid, { type: "session_init", phase: "setup", ts });
        return yield* el.isActive(sid);
      }),
    );
    expect(result).toBe(true);
  });

  test("isActive returns false after terminal completion phase_advance", async () => {
    const sid = SessionId(`session-active-false-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("completed task"));
        yield* el.appendManifest(sid, { type: "session_init", phase: "setup", ts });
        yield* el.appendManifest(sid, phaseAdvanceEvent("completion", "all done"));
        return yield* el.isActive(sid);
      }),
    );
    expect(result).toBe(false);
  });

  test("isActive returns false with legacy 2-completion-event format", async () => {
    const sid = SessionId(`session-active-false-legacy-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("completed task"));
        yield* el.appendManifest(sid, { type: "session_init", phase: "setup", ts });
        yield* el.appendManifest(
          sid,
          phaseAdvanceEvent("completion", "arriving at completion", "completion"),
        );
        yield* el.appendManifest(sid, phaseAdvanceEvent("completion", "all done"));
        return yield* el.isActive(sid);
      }),
    );
    expect(result).toBe(false);
  });

  test("isActive returns false when no session_init", async () => {
    const sid = SessionId(`session-active-nostart-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        return yield* el.isActive(sid);
      }),
    );
    expect(result).toBe(false);
  });

  test("isDraft returns true after task_start with no phase_advance", async () => {
    const sid = SessionId(`session-draft-true-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("draft task"));
        return yield* el.isDraft(sid);
      }),
    );
    expect(result).toBe(true);
  });

  test("isDraft returns false after session_init", async () => {
    const sid = SessionId(`session-draft-false-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("advanced task"));
        yield* el.appendManifest(sid, { type: "session_init", phase: "setup", ts });
        return yield* el.isDraft(sid);
      }),
    );
    expect(result).toBe(false);
  });

  test("currentTask returns task name from last task_start", async () => {
    const sid = SessionId(`session-curtask-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("important task"));
        return yield* el.currentTask(sid);
      }),
    );
    expect(result).toBe("important task");
  });

  test("currentTask returns undefined when completed", async () => {
    const sid = SessionId(`session-curtask-done-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("finished task"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("completion", "done"));
        return yield* el.currentTask(sid);
      }),
    );
    expect(result).toBeUndefined();
  });

  test("currentPhase returns next_phase from last phase_advance", async () => {
    const sid = SessionId(`session-curphase-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("phased task"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("setup", "setup reflection", "triage"));
        yield* el.appendManifest(
          sid,
          phaseAdvanceEvent("triage", "triage reflection", "discovery"),
        );
        return yield* el.currentPhase(sid);
      }),
    );
    expect(result).toBe("discovery");
  });

  test("currentPhase falls back to phase for legacy events without next_phase", async () => {
    const sid = SessionId(`session-curphase-legacy-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("legacy task"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("triage", "triage reflection"));
        return yield* el.currentPhase(sid);
      }),
    );
    expect(result).toBe("triage");
  });

  test("currentPhase returns undefined when completed (terminal completion)", async () => {
    const sid = SessionId(`session-curphase-done-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("done task"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("completion", "finished"));
        return yield* el.currentPhase(sid);
      }),
    );
    expect(result).toBeUndefined();
  });

  test("currentPhase returns undefined when no phase_advance exists", async () => {
    const sid = SessionId(`session-curphase-none-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("no phase task"));
        return yield* el.currentPhase(sid);
      }),
    );
    expect(result).toBeUndefined();
  });

  test("taskSize returns size from task_start with size field", async () => {
    const sid = SessionId(`session-tasksize-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("sized task", "MEDIUM"));
        return yield* el.taskSize(sid);
      }),
    );
    expect(result).toBe("MEDIUM");
  });

  test("taskSize returns undefined when no size field", async () => {
    const sid = SessionId(`session-tasksize-none-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("unsized task"));
        return yield* el.taskSize(sid);
      }),
    );
    expect(result).toBeUndefined();
  });

  test("completedPhases returns all phase_advance phase names (source phases)", async () => {
    const sid = SessionId(`session-completed-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("multi-phase"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("setup", "r1", "triage"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("triage", "r2", "discovery"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("discovery", "r3", "skill_discovery"));
        return yield* el.completedPhases(sid);
      }),
    );
    expect(result).toEqual(["setup", "triage", "discovery"]);
  });

  test("reflections returns phase and reflection pairs (phase = source)", async () => {
    const sid = SessionId(`session-reflections-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("reflect task"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("setup", "setup thought", "triage"));
        yield* el.appendManifest(sid, phaseAdvanceEvent("triage", "triage thought", "discovery"));
        return yield* el.reflections(sid);
      }),
    );
    expect(result).toEqual([
      { phase: "setup", reflection: "setup thought" },
      { phase: "triage", reflection: "triage thought" },
    ]);
  });

  test("observations returns observation texts", async () => {
    const sid = SessionId(`session-observations-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendManifest(sid, taskStartEvent("observe task"));
        yield* el.appendManifest(sid, observationEvent("first observation"));
        yield* el.appendManifest(sid, observationEvent("second observation"));
        return yield* el.observations(sid);
      }),
    );
    expect(result).toEqual(["first observation", "second observation"]);
  });
});

describe("EventLog JSON operations", () => {
  test("writeJson and readJson round-trip", async () => {
    const sid = SessionId(`session-json-rt-${Date.now()}`);
    const data = { name: "test", value: 42 };
    const TestSchema = Schema.Struct({ name: Schema.String, value: Schema.Number });
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.writeJson(sid, "ns", "key1", data, TestSchema);
        return yield* el.readJson(sid, "ns", "key1", TestSchema);
      }),
    );
    expect(result).toEqual(data);
  });

  test("readJson returns undefined for non-existent file", async () => {
    const sid = SessionId(`session-json-nofile-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        return yield* el.readJson(sid, "ns", "missing", Schema.String);
      }),
    );
    expect(result).toBeUndefined();
  });

  test("readJson on malformed JSON throws EventLogError", async () => {
    const sid = SessionId(`session-json-malformed-${Date.now()}`);
    const nsDir = join(tempDir, "out", sid, "ns");
    mkdirSync(nsDir, { recursive: true });
    writeFileSync(join(nsDir, "bad.json"), "not valid json {{{");
    const promise = run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        return yield* el.readJson(sid, "ns", "bad", Schema.String);
      }),
    );
    await expect(promise).rejects.toThrow();
  });
});

describe("EventLog session discovery", () => {
  test("resolveByKey finds session containing matching JSON file", async () => {
    const sid = SessionId(`session-resolve-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.writeJson(
          sid,
          "bridge",
          "claude-123",
          { found: true },
          Schema.Struct({ found: Schema.Boolean }),
        );
        return yield* el.resolveByKey("bridge", "claude-123");
      }),
    );
    expect(result).toBe(sid);
  });

  test("resolveByKey returns undefined when no match", async () => {
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        return yield* el.resolveByKey("bridge", "nonexistent-key");
      }),
    );
    expect(result).toBeUndefined();
  });

  test("findActiveSession returns undefined when multiple active sessions exist", async () => {
    const isolatedTmp = mkdtempSync(join(tmpdir(), "eventlog-latest-"));
    const isolatedConfigLayer = Layer.succeed(
      Config,
      Config.of({
        root: isolatedTmp,
        configPath: join(isolatedTmp, "config.yaml"),
        outDir: join(isolatedTmp, "out"),
        socketPath: join(isolatedTmp, ".anakmagang", "events.sock"),
        projectName: "test-project",
        webSocketPath: join(isolatedTmp, ".anakmagang", "events.sock"),
        readConfig: Effect.die("not used"),
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
    const isolatedLayers = EventLog.bare.pipe(
      Layer.provide(isolatedConfigLayer),
      Layer.provideMerge(BunServices.layer),
    );
    const sid1 = SessionId("session-aaa");
    const sid2 = SessionId("session-bbb");
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid1);
        yield* el.appendManifest(sid1, taskStartEvent("first"));
        yield* el.appendManifest(sid1, { type: "session_init", phase: "setup", ts });
        yield* el.createSession(sid2);
        yield* el.appendManifest(sid2, taskStartEvent("second"));
        yield* el.appendManifest(sid2, { type: "session_init", phase: "setup", ts });
        return yield* el.findActiveSession();
      }).pipe(Effect.provide(isolatedLayers)),
    );
    expect(result).toBeUndefined();
    rmSync(isolatedTmp, { recursive: true, force: true });
  });

  test("findActiveSession skips completed sessions", async () => {
    const isolatedTmp = mkdtempSync(join(tmpdir(), "eventlog-skip-"));
    const isolatedConfigLayer = Layer.succeed(
      Config,
      Config.of({
        root: isolatedTmp,
        configPath: join(isolatedTmp, "config.yaml"),
        outDir: join(isolatedTmp, "out"),
        socketPath: join(isolatedTmp, ".anakmagang", "events.sock"),
        projectName: "test-project",
        webSocketPath: join(isolatedTmp, ".anakmagang", "events.sock"),
        readConfig: Effect.die("not used"),
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
    const isolatedLayers = EventLog.bare.pipe(
      Layer.provide(isolatedConfigLayer),
      Layer.provideMerge(BunServices.layer),
    );
    const sidActive = SessionId("session-active");
    const sidDone = SessionId("session-done");
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sidActive);
        yield* el.appendManifest(sidActive, taskStartEvent("active one"));
        yield* el.appendManifest(sidActive, { type: "session_init", phase: "setup", ts });
        yield* el.createSession(sidDone);
        yield* el.appendManifest(sidDone, taskStartEvent("done one"));
        yield* el.appendManifest(sidDone, { type: "session_init", phase: "setup", ts });
        yield* el.appendManifest(sidDone, phaseAdvanceEvent("completion", "finished"));
        return yield* el.findActiveSession();
      }).pipe(Effect.provide(isolatedLayers)),
    );
    expect(result).toBe(sidActive);
    rmSync(isolatedTmp, { recursive: true, force: true });
  });

  test("findActiveSession returns undefined when no active sessions", async () => {
    const emptyTmp = mkdtempSync(join(tmpdir(), "eventlog-noactive-"));
    const emptyConfigLayer = Layer.succeed(
      Config,
      Config.of({
        root: emptyTmp,
        configPath: join(emptyTmp, "config.yaml"),
        outDir: join(emptyTmp, "out"),
        socketPath: join(emptyTmp, ".anakmagang", "events.sock"),
        projectName: "test-project",
        webSocketPath: join(emptyTmp, ".anakmagang", "events.sock"),
        readConfig: Effect.die("not used"),
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
    const emptyLayers = EventLog.bare.pipe(
      Layer.provide(emptyConfigLayer),
      Layer.provideMerge(BunServices.layer),
    );
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const el = yield* EventLog;
        return yield* el.findActiveSession();
      }).pipe(Effect.provide(emptyLayers)),
    );
    expect(result).toBeUndefined();
    rmSync(emptyTmp, { recursive: true, force: true });
  });
});

describe("EventLog iteration counting", () => {
  test("iterationCount returns 0 for new agent", async () => {
    const sid = SessionId(`session-iter-zero-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        return yield* el.iterationCount(sid, "effect-ts", "abc123");
      }),
    );
    expect(result).toBe(0);
  });

  test("iterationCount returns correct count after appendLog", async () => {
    const sid = SessionId(`session-iter-count-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.appendLog(sid, iterationEvent("effect-ts", "hash1"));
        yield* el.appendLog(sid, iterationEvent("effect-ts", "hash1"));
        yield* el.appendLog(sid, iterationEvent("effect-ts", "hash1"));
        yield* el.appendLog(sid, iterationEvent("nix-coder", "hash1"));
        yield* el.appendLog(sid, iterationEvent("effect-ts", "hash2"));
        return yield* el.iterationCount(sid, "effect-ts", "hash1");
      }),
    );
    expect(result).toBe(3);
  });
});
