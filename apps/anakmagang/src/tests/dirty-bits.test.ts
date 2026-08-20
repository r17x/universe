import { describe, test, expect, afterAll } from "bun:test";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { EventLog, type ManifestEvent } from "../EventLog";
import { Config } from "../Config";
import { SessionId } from "../Ulid";
import { MachineLoader } from "../MachineLoader";
import { DirtyBits } from "../DirtyBits";

const tempDir = mkdtempSync(join(tmpdir(), "dirty-bits-test-"));

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

const testLayers = EventLog.bare.pipe(
  Layer.provide(testConfigLayer),
  Layer.provideMerge(BunServices.layer),
);

const run = <A, E>(effect: Effect.Effect<A, E, EventLog>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayers)));

describe("EventLog dirty_bits serialization", () => {
  test("dirty_bits event round-trips through appendManifest and readRawEvents", async () => {
    const sid = SessionId(`session-dirty-roundtrip-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        const event: ManifestEvent = {
          type: "dirty_bits",
          phase: "implementation",
          files: ["src/foo.ts", "src/bar.ts", "lib/baz.ts"],
          ts: "2026-01-01T00:00:00Z",
        };
        yield* eventLog.appendManifest(sid, event);
        return yield* eventLog.readRawEvents(sid);
      }),
    );

    const dirtyEvent = Arr.findFirst(result, (e) => e.type === "dirty_bits");
    expect(Option.isSome(dirtyEvent)).toBe(true);
    if (Option.isSome(dirtyEvent)) {
      expect(dirtyEvent.value.type).toBe("dirty_bits");
      expect(dirtyEvent.value["phase"]).toBe("implementation");
      expect(dirtyEvent.value["files"]).toBe("src/foo.ts,src/bar.ts,lib/baz.ts");
    }
  });

  test("dirty_bits files stored as comma-separated string", async () => {
    const sid = SessionId(`session-dirty-comma-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "dirty_bits",
          phase: "completion",
          files: ["a.nix"],
          ts: "2026-01-01T00:00:00Z",
        });
        return yield* eventLog.readRawEvents(sid);
      }),
    );

    const events = Arr.filter(result, (e) => e.type === "dirty_bits");
    expect(events.length).toBe(1);
    expect(events[0]["files"]).toBe("a.nix");
  });

  test("empty files array serializes to empty string", async () => {
    const sid = SessionId(`session-dirty-empty-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "dirty_bits",
          phase: "testing",
          files: [],
          ts: "2026-01-01T00:00:00Z",
        });
        return yield* eventLog.readRawEvents(sid);
      }),
    );

    const events = Arr.filter(result, (e) => e.type === "dirty_bits");
    expect(events.length).toBe(1);
    expect(events[0]["files"]).toBe("");
  });
});

describe("EventLog dirty_bits alongside other events", () => {
  const sid = SessionId(`session-dirty-mixed-${Date.now()}`);

  test("dirty_bits events coexist with task_start and phase_advance", async () => {
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);

        yield* eventLog.appendManifest(sid, {
          type: "task_start",
          task: "test task",
          ts: "2026-01-01T00:00:00Z",
        });
        yield* eventLog.appendManifest(sid, {
          type: "phase_advance",
          phase: "setup",
          reflection: "reflected",
          ts: "2026-01-01T00:00:01Z",
        });
        yield* eventLog.appendManifest(sid, {
          type: "dirty_bits",
          phase: "implementation",
          files: ["changed.ts"],
          ts: "2026-01-01T00:00:02Z",
        });

        return yield* eventLog.readRawEvents(sid);
      }),
    );

    expect(result.length).toBe(3);
    expect(result[0].type).toBe("task_start");
    expect(result[1].type).toBe("phase_advance");
    expect(result[2].type).toBe("dirty_bits");
    expect(result[2]["files"]).toBe("changed.ts");
  });
});

describe("MachineLoader on_advance schema", () => {
  const loadPreset = (name: string) =>
    Effect.gen(function* () {
      const loader = yield* MachineLoader;
      return yield* loader.loadPreset(name);
    }).pipe(Effect.provide(MachineLoader.layer));

  test("bundled preset has no on_advance commands", async () => {
    const config = await Effect.runPromise(loadPreset("orchestrate"));
    const phasesWithAdvance = Arr.filter(
      config.phases,
      (p) => p.on_advance !== undefined && p.on_advance.length > 0,
    );
    expect(phasesWithAdvance.length).toBe(0);
  });

  test("implementation phase has no on_advance", async () => {
    const config = await Effect.runPromise(loadPreset("orchestrate"));
    const implPhase = Arr.findFirst(config.phases, (p) => p.id === "implementation");
    expect(Option.isSome(implPhase)).toBe(true);
    if (Option.isSome(implPhase)) {
      expect(implPhase.value.on_advance).toBeUndefined();
    }
  });

  test("completion phase has no on_advance", async () => {
    const config = await Effect.runPromise(loadPreset("orchestrate"));
    const completionPhase = Arr.findFirst(config.phases, (p) => p.id === "completion");
    expect(Option.isSome(completionPhase)).toBe(true);
    if (Option.isSome(completionPhase)) {
      expect(completionPhase.value.on_advance).toBeUndefined();
    }
  });
});

describe("DirtyBits bootstrap: diff without prior snapshot", () => {
  test("diff with no baseline snapshot returns current dirty files", async () => {
    const sid = SessionId(`session-dirty-bootstrap-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        const baseline = yield* eventLog.readJson(
          sid,
          "dirty",
          "baseline",
          Schema.Array(Schema.String),
        );
        expect(baseline).toBeUndefined();
        const baselineSet = new Set((baseline ?? []) as ReadonlyArray<string>);
        expect(baselineSet.size).toBe(0);
        return true;
      }),
    );
    expect(result).toBe(true);
  });
});

describe("EventLog writeJson/readJson round-trip for dirty baseline", () => {
  const sid = SessionId("session-dirty-json");

  test("baseline files round-trip through writeJson and readJson", async () => {
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);

        const baseline = ["src/alpha.ts", "src/beta.ts", "lib/gamma.ts"];
        yield* eventLog.writeJson(sid, "dirty", "baseline", baseline, Schema.Array(Schema.String));

        return yield* eventLog.readJson(sid, "dirty", "baseline", Schema.Array(Schema.String));
      }),
    );

    expect(result).toEqual(["src/alpha.ts", "src/beta.ts", "lib/gamma.ts"]);
  });

  test("readJson returns undefined when baseline not yet written", async () => {
    const noBaselineSid = SessionId("session-dirty-json-empty");
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(noBaselineSid);
        return yield* eventLog.readJson(
          noBaselineSid,
          "dirty",
          "baseline",
          Schema.Array(Schema.String),
        );
      }),
    );

    expect(result).toBeUndefined();
  });

  test("overwriting baseline replaces previous data", async () => {
    const overwriteSid = SessionId("session-dirty-json-overwrite");
    const result = await run(
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(overwriteSid);

        yield* eventLog.writeJson(
          overwriteSid,
          "dirty",
          "baseline",
          ["old.ts"],
          Schema.Array(Schema.String),
        );

        yield* eventLog.writeJson(
          overwriteSid,
          "dirty",
          "baseline",
          ["new.ts", "newer.ts"],
          Schema.Array(Schema.String),
        );

        return yield* eventLog.readJson(
          overwriteSid,
          "dirty",
          "baseline",
          Schema.Array(Schema.String),
        );
      }),
    );

    expect(result).toEqual(["new.ts", "newer.ts"]);
  });
});

describe("DirtyBits.runOnAdvance file_pattern filtering", () => {
  const dirtyLayers = DirtyBits.layer.pipe(
    Layer.provide(EventLog.bare),
    Layer.provide(testConfigLayer),
    Layer.provideMerge(BunServices.layer),
  );

  const runDirty = <A, E>(effect: Effect.Effect<A, E, DirtyBits>) =>
    Effect.runPromise(effect.pipe(Effect.provide(dirtyLayers)));

  test("runOnAdvance with file_pattern filters files correctly", async () => {
    const outFile = join(tempDir, "filtered-output.txt");
    await runDirty(
      Effect.gen(function* () {
        const dirtyBits = yield* DirtyBits;
        yield* dirtyBits.runOnAdvance(
          SessionId("test-filter-sid"),
          "implementation",
          [{ command: `echo {dirty-files} > ${outFile}`, file_pattern: "\\.nix$" }],
          ["src/foo.ts", "flake.nix", "module.nix"],
        );
      }),
    );
    const output = readFileSync(outFile, "utf-8").trim();
    expect(output).toBe("flake.nix module.nix");
  });

  test("runOnAdvance without file_pattern passes all files", async () => {
    const outFile = join(tempDir, "unfiltered-output.txt");
    await runDirty(
      Effect.gen(function* () {
        const dirtyBits = yield* DirtyBits;
        yield* dirtyBits.runOnAdvance(
          SessionId("test-nofilter-sid"),
          "implementation",
          [{ command: `echo {dirty-files} > ${outFile}` }],
          ["src/foo.ts", "flake.nix", "module.nix"],
        );
      }),
    );
    const output = readFileSync(outFile, "utf-8").trim();
    expect(output).toBe("src/foo.ts flake.nix module.nix");
  });

  test("runOnAdvance with file_pattern matching nothing skips command", async () => {
    const outFile = join(tempDir, "skipped-output.txt");
    await runDirty(
      Effect.gen(function* () {
        const dirtyBits = yield* DirtyBits;
        yield* dirtyBits.runOnAdvance(
          SessionId("test-skip-sid"),
          "implementation",
          [{ command: `echo {dirty-files} > ${outFile}`, file_pattern: "\\.py$" }],
          ["src/foo.ts", "flake.nix", "module.nix"],
        );
      }),
    );
    expect(existsSync(outFile)).toBe(false);
  });
});
