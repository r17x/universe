import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { EventLog } from "../EventLog";
import { Config } from "../Config";
import { MachineLoader } from "../MachineLoader";
import { MemoryStore, type MemoryStoreContract } from "../MemoryStore";
import { DirtyBits, type DirtyBitsContract } from "../DirtyBits";
import { GuardEvaluator, type GuardEvaluatorContract } from "../guard";
import { Allow } from "../protocol.GuardResult";
import { PhaseEngine } from "../PhaseEngine";
import { isUlid } from "../Ulid";

const tempDir = mkdtempSync(join(tmpdir(), "phase-engine-test-"));

const configSource = join(import.meta.dir, "..", "..", "..", "..", ".anakmagang", "config.yaml");
const configTarget = join(tempDir, ".anakmagang", "config.yaml");
mkdirSync(join(tempDir, ".anakmagang"), { recursive: true });
copyFileSync(configSource, configTarget);

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const testConfigLayer = Layer.succeed(
  Config,
  Config.of({
    root: tempDir,
    configPath: configTarget,
    outDir: join(tempDir, ".anakmagang", "out"),
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

const mockDirtyBitsLayer = Layer.succeed(
  DirtyBits,
  DirtyBits.of({
    snapshot: (_sid: string) => Effect.succeed([] as readonly string[]),
    diff: (_sid: string) => Effect.succeed([] as readonly string[]),
    runOnAdvance: (
      _sid: string,
      _phase: string,
      _commands: ReadonlyArray<{
        readonly command: string;
        readonly file_pattern?: string | undefined;
      }>,
      _files: ReadonlyArray<string>,
    ) => Effect.void,
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
    status: () => Effect.die("not used"),
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

const TestLayer = PhaseEngine.layer.pipe(Layer.provide(BaseLayers), Layer.provideMerge(BaseLayers));

const run = <A, E>(effect: Effect.Effect<A, E, PhaseEngine | EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

describe("PhaseEngine.start (new session)", () => {
  test("returns a valid ULID session ID", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        return yield* engine.start("test task");
      }),
    );
    expect(isUlid(result.sessionId)).toBe(true);
  });

  test("first phase is setup with number 1", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        return yield* engine.start("build feature");
      }),
    );
    expect(result.phase.id).toBe("setup");
    expect(result.phase.name).toBe("Setup");
    expect(result.phase.number).toBe(1);
  });

  test("returns an exit question for setup phase", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        return yield* engine.start("some task");
      }),
    );
    expect(result.question.length).toBeGreaterThan(0);
  });

  test("totalPhases equals 16 for orchestrate preset", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        return yield* engine.start("count phases");
      }),
    );
    expect(result.totalPhases).toBe(16);
  });

  test("manifest has task_start and session_init events", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* engine.start("manifest check");
        const eventLog = yield* EventLog;
        const events = yield* eventLog.readRawEvents(startResult.sessionId);
        return events;
      }),
    );
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].type).toBe("task_start");
    expect(result[1].type).toBe("session_init");
  });
});

describe("PhaseEngine.draft", () => {
  test("returns a valid ULID session ID", async () => {
    const sid = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        return yield* engine.draft("draft task");
      }),
    );
    expect(isUlid(sid)).toBe(true);
  });

  test("creates session with task_start but no phase_advance", async () => {
    const events = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const sid = yield* engine.draft("draft only");
        const eventLog = yield* EventLog;
        return yield* eventLog.readRawEvents(sid);
      }),
    );
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("task_start");
  });

  test("session is in draft state", async () => {
    const isDraft = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const sid = yield* engine.draft("check draft state");
        const eventLog = yield* EventLog;
        return yield* eventLog.isDraft(sid);
      }),
    );
    expect(isDraft).toBe(true);
  });
});

describe("PhaseEngine.start (resume draft)", () => {
  test("promoting a draft session succeeds and returns setup phase", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const sid = yield* engine.draft("promotable task");
        return yield* engine.start(sid);
      }),
    );
    expect(result.phase.id).toBe("setup");
    expect(result.phase.number).toBe(1);
  });

  test("starting an already-started session throws", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* engine.start("already started task");
        return yield* engine.start(startResult.sessionId);
      }).pipe(Effect.provide(TestLayer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("PhaseEngine.eval (forward transitions)", () => {
  const startAndSetupSession = Effect.gen(function* () {
    const engine = yield* PhaseEngine;
    const startResult = yield* engine.start("eval test task");
    return startResult;
  });

  test("setup phase with --size SMALL advances forward", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* startAndSetupSession;
        return yield* engine.eval({
          reflection: "No assumptions carried. Past feedback reviewed.",
          sessionId: startResult.sessionId,
          size: "SMALL",
        });
      }),
    );
    expect(result._tag).toBe("Advanced");
    expect(result.from.id).toBe("setup");
    if (result._tag === "Advanced") {
      expect(result.to).toBeDefined();
      expect(result.to.id).toBe("triage");
    }
  });

  test("setup without size returns PhaseEngineError", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* startAndSetupSession;
        return yield* engine.eval({
          reflection: "Some reflection",
          sessionId: startResult.sessionId,
        });
      }).pipe(Effect.provide(TestLayer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const cause = exit.cause;
      const pretty = JSON.stringify(cause);
      expect(pretty).toContain("Size classification required");
    }
  });

  test("normal forward transition after setup", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* startAndSetupSession;
        yield* engine.eval({
          reflection: "Setup complete",
          sessionId: startResult.sessionId,
          size: "LARGE",
        });
        return yield* engine.eval({
          reflection: "Triaged correctly",
          sessionId: startResult.sessionId,
        });
      }),
    );
    expect(result._tag).toBe("Advanced");
    expect(result.from.id).toBe("triage");
    if (result._tag === "Advanced") {
      expect(result.to).toBeDefined();
    }
  });

  test("forwarding to completion phase marks session as forward-to-completion", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* startAndSetupSession;

        yield* engine.eval({
          reflection: "Setup reflection",
          sessionId: startResult.sessionId,
          size: "TRIVIAL",
        });

        return yield* engine.eval({
          reflection: "Implementation done",
          sessionId: startResult.sessionId,
        });
      }),
    );
    expect(result._tag).toBe("Advanced");
    expect(result.from.id).toBe("implementation");
    if (result._tag === "Advanced") {
      expect(result.to).toBeDefined();
      expect(result.to.id).toBe("completion");
    }
  });

  test("already completed session returns already_complete", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* startAndSetupSession;

        yield* engine.eval({
          reflection: "Setup reflection",
          sessionId: startResult.sessionId,
          size: "TRIVIAL",
        });
        yield* engine.eval({
          reflection: "Implementation done",
          sessionId: startResult.sessionId,
        });
        yield* engine.eval({
          reflection: "Completion reflection for the session",
          sessionId: startResult.sessionId,
        });

        return yield* engine.eval({
          reflection: "Trying again after complete",
          sessionId: startResult.sessionId,
        });
      }),
    );
    expect(result._tag).toBe("Completed");
    if (result._tag === "Completed") {
      expect(result.rule).toBe("already_complete");
    }
  });

  test("completion phase preserves coordinator reflection", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const eventLog = yield* EventLog;
        const startResult = yield* startAndSetupSession;

        yield* engine.eval({
          reflection: "Setup done",
          sessionId: startResult.sessionId,
          size: "TRIVIAL",
        });
        yield* engine.eval({
          reflection: "Learned to always validate terminal writes",
          sessionId: startResult.sessionId,
        });

        const completionResult = yield* engine.eval({
          reflection: "Learned to always validate terminal writes in completion",
          sessionId: startResult.sessionId,
        });

        const reflections = yield* eventLog.reflections(startResult.sessionId);
        const implReflections = reflections.filter(
          (r) => r.phase === "implementation" && r.reflection !== "",
        );
        const completionReflections = reflections.filter(
          (r) => r.phase === "completion" && r.reflection !== "",
        );
        const isActive = yield* eventLog.isActive(startResult.sessionId);

        return { completionResult, reflections, implReflections, completionReflections, isActive };
      }),
    );
    expect(result.completionResult._tag).toBe("Completed");
    if (result.completionResult._tag === "Completed") {
      expect(result.completionResult.rule).toBe("final_phase");
    }
    expect(result.implReflections).toHaveLength(1);
    expect(result.implReflections[0]?.reflection).toBe(
      "Learned to always validate terminal writes",
    );
    expect(result.completionReflections).toHaveLength(1);
    expect(result.completionReflections[0]?.reflection).toBe(
      "Learned to always validate terminal writes in completion",
    );
    expect(result.isActive).toBe(false);
  });
});

describe("PhaseEngine.eval (backward transitions)", () => {
  test("confidence low goes back to previous phase", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* engine.start("backward test");

        yield* engine.eval({
          reflection: "Setup done",
          sessionId: startResult.sessionId,
          size: "LARGE",
        });

        return yield* engine.eval({
          reflection: "Not confident about triage",
          sessionId: startResult.sessionId,
          confidence: "low",
        });
      }),
    );
    expect(result._tag).toBe("LoopedBack");
    expect(result.from.id).toBe("triage");
    if (result._tag === "LoopedBack") {
      expect(result.rule).toBe("confidence_low");
      expect(result.to).toBeDefined();
      expect(result.to.id).toBe("setup");
      expect(result.question).toBeDefined();
    }
  });

  test("confidence low at first phase returns PhaseEngineError", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* engine.start("stuck at first");
        return yield* engine.eval({
          reflection: "Not sure",
          sessionId: startResult.sessionId,
          size: "LARGE",
          confidence: "low",
        });
      }).pipe(Effect.provide(TestLayer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const pretty = JSON.stringify(exit.cause);
      expect(pretty).toContain("Already at first phase");
    }
  });
});

describe("PhaseEngine.eval (error cases)", () => {
  test("eval on draft session returns PhaseEngineError", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const sid = yield* engine.draft("draft eval test");
        return yield* engine.eval({
          reflection: "Attempt eval on draft",
          sessionId: sid,
        });
      }).pipe(Effect.provide(TestLayer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const pretty = JSON.stringify(exit.cause);
      expect(pretty).toContain("is a draft");
    }
  });
});

describe("PhaseEngine.observe", () => {
  test("appends observation to manifest without advancing phase", async () => {
    const result = await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* engine.start("observe test");
        const eventLog = yield* EventLog;

        const eventsBefore = yield* eventLog.readRawEvents(startResult.sessionId);
        const phaseBefore = yield* eventLog.currentPhase(startResult.sessionId);

        yield* engine.observe("found an interesting pattern", startResult.sessionId);

        const eventsAfter = yield* eventLog.readRawEvents(startResult.sessionId);
        const phaseAfter = yield* eventLog.currentPhase(startResult.sessionId);

        return { eventsBefore, eventsAfter, phaseBefore, phaseAfter };
      }),
    );

    expect(result.eventsAfter.length).toBe(result.eventsBefore.length + 1);
    const lastEvent = result.eventsAfter[result.eventsAfter.length - 1];
    expect(lastEvent.type).toBe("observation");
    expect(lastEvent["text"]).toContain("found an interesting pattern");
    expect(result.phaseAfter ?? "none").toBe(result.phaseBefore ?? "none");
  });
});

describe("PhaseEngine size presets affect active phases", () => {
  test("TRIVIAL skips to setup, implementation, completion", async () => {
    const phases: string[] = [];
    await run(
      Effect.gen(function* () {
        const engine = yield* PhaseEngine;
        const startResult = yield* engine.start("trivial task");
        phases.push(startResult.phase.id);

        const r1 = yield* engine.eval({
          reflection: "Setup done",
          sessionId: startResult.sessionId,
          size: "TRIVIAL",
        });
        if (r1._tag === "Advanced" || r1._tag === "LoopedBack") phases.push(r1.to.id);

        const r2 = yield* engine.eval({
          reflection: "Implemented",
          sessionId: startResult.sessionId,
        });
        if (r2._tag === "Advanced" || r2._tag === "LoopedBack") phases.push(r2.to.id);
      }),
    );
    expect(phases[0]).toBe("setup");
    expect(phases[1]).toBe("implementation");
    expect(phases[2]).toBe("completion");
  });
});
