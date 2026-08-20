import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { tmpdir } from "os";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { EventLog } from "../EventLog";
import { Config } from "../Config";
import { SessionId } from "../Ulid";

const tempDir = mkdtempSync(join(tmpdir(), "add-test-"));

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

describe("EventLog artifact round-trip", () => {
  test("addArtifact and listArtifacts round-trip", async () => {
    const sid = SessionId(`session-artifact-rt-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.addArtifact(sid, {
          path: "artifacts/plan.md",
          source: "/tmp/plan.md",
          tags: ["effect-ts", "plan"],
          size: 1234,
        });
        return yield* el.listArtifacts(sid);
      }),
    );
    expect(result.length).toBe(1);
    expect(result[0].path).toBe("artifacts/plan.md");
    expect(result[0].source).toBe("/tmp/plan.md");
    expect(result[0].tags).toEqual(["effect-ts", "plan"]);
    expect(result[0].size).toBe(1234);
  });
});

describe("EventLog artifact manifest serialization", () => {
  test("manifest contains artifact_add with correct fields", async () => {
    const sid = SessionId(`session-artifact-serial-${Date.now()}`);
    await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.addArtifact(sid, {
          path: "artifacts/design.md",
          source: "/tmp/design.md",
          tags: ["architecture"],
          size: 5678,
        });
      }),
    );
    const raw = readFileSync(join(tempDir, "out", sid, "manifest.yaml"), "utf-8");
    expect(raw).toContain("type: artifact_add");
    expect(raw).toContain("artifacts/design.md");
    expect(raw).toContain("/tmp/design.md");
    expect(raw).toContain("architecture");
    expect(raw).toContain("5678");
  });
});

describe("EventLog multiple artifacts", () => {
  test("listArtifacts returns all artifacts in order", async () => {
    const sid = SessionId(`session-artifact-multi-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.addArtifact(sid, {
          path: "a.md",
          source: "/tmp/a.md",
          tags: ["first"],
          size: 100,
        });
        yield* el.addArtifact(sid, {
          path: "b.md",
          source: "/tmp/b.md",
          tags: ["second"],
          size: 200,
        });
        yield* el.addArtifact(sid, {
          path: "c.md",
          source: "/tmp/c.md",
          tags: ["third"],
          size: 300,
        });
        return yield* el.listArtifacts(sid);
      }),
    );
    expect(result.length).toBe(3);
    expect(result[0].path).toBe("a.md");
    expect(result[1].path).toBe("b.md");
    expect(result[2].path).toBe("c.md");
  });
});

describe("EventLog artifact empty tags", () => {
  test("empty tags array round-trips without ghost entries", async () => {
    const sid = SessionId(`session-artifact-emptytags-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.addArtifact(sid, {
          path: "no-tags.md",
          source: "/tmp/no-tags.md",
          tags: [],
          size: 42,
        });
        return yield* el.listArtifacts(sid);
      }),
    );
    expect(result.length).toBe(1);
    expect(result[0].tags).toEqual([]);
  });
});

describe("EventLog readRawEvents includes artifact_add", () => {
  test("readRawEvents returns artifact_add entries", async () => {
    const sid = SessionId(`session-artifact-raw-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.addArtifact(sid, {
          path: "raw.md",
          source: "/tmp/raw.md",
          tags: ["test"],
          size: 99,
        });
        return yield* el.readRawEvents(sid);
      }),
    );
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("artifact_add");
    expect(result[0]["path"]).toBe("raw.md");
    expect(result[0]["source"]).toBe("/tmp/raw.md");
    expect(result[0]["tags"]).toBe("test");
    expect(result[0]["size"]).toBe("99");
  });
});

describe("EventLog syncArtifacts", () => {
  const sessionDir = (sid: string) => join(tempDir, "out", sid);

  test("discovers untracked files", async () => {
    const sid = SessionId(`session-sync-discover-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        writeFileSync(join(sessionDir(sid), "plan.md"), "# Plan");
        const synced = yield* el.syncArtifacts(sid);
        const artifacts = yield* el.listArtifacts(sid);
        return { synced, artifacts };
      }),
    );
    expect(result.synced.length).toBe(1);
    expect(result.synced[0].path).toBe("plan.md");
    expect(result.artifacts.length).toBe(1);
    expect(result.artifacts[0].source).toBe("sync");
    expect(result.artifacts[0].tags).toEqual([]);
  });

  test("skips infrastructure files", async () => {
    const sid = SessionId(`session-sync-infra-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        const dir = sessionDir(sid);
        mkdirSync(join(dir, "dirty"), { recursive: true });
        mkdirSync(join(dir, "claude"), { recursive: true });
        writeFileSync(join(dir, "dirty", "baseline.json"), "{}");
        writeFileSync(join(dir, "claude", "bridge.json"), "{}");
        return yield* el.syncArtifacts(sid);
      }),
    );
    expect(result.length).toBe(0);
  });

  test("is idempotent", async () => {
    const sid = SessionId(`session-sync-idempotent-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        writeFileSync(join(sessionDir(sid), "plan.md"), "# Plan");
        const first = yield* el.syncArtifacts(sid);
        const second = yield* el.syncArtifacts(sid);
        const artifacts = yield* el.listArtifacts(sid);
        return { first, second, artifacts };
      }),
    );
    expect(result.first.length).toBe(1);
    expect(result.second.length).toBe(0);
    expect(result.artifacts.length).toBe(1);
  });

  test("skips already-tracked artifacts", async () => {
    const sid = SessionId(`session-sync-tracked-${Date.now()}`);
    const result = await run(
      Effect.gen(function* () {
        const el = yield* EventLog;
        yield* el.createSession(sid);
        yield* el.addArtifact(sid, {
          path: "plan.md",
          source: "/tmp/plan.md",
          tags: ["plan"],
          size: 100,
        });
        writeFileSync(join(sessionDir(sid), "plan.md"), "# Plan");
        return yield* el.syncArtifacts(sid);
      }),
    );
    expect(result.length).toBe(0);
  });
});
