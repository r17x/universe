import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { injectReminders } from "../../../guard.inject-reminders";
import type { GuardContext, HookInput, HookEnv, GuardConfig } from "../../../guard";
import { EventLog } from "../../../EventLog";
import { Config } from "../../../Config";
import { Bridge } from "../../../Bridge";
import { MemoryStore, type MemoryDir } from "../../../MemoryStore";
import { ExperimentalFeatures } from "../../../ExperimentalFeatures";
import { SessionId } from "../../../Ulid";

const ITERATIONS = 10;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const CWD = join(import.meta.dir, "..", "..", "..", "..");

const makeSessionFixture = (tmp: string) => {
  const outDir = join(tmp, "out");
  const configPath = join(tmp, "config.yaml");
  return { root: tmp, outDir, configPath };
};

const setupLayers = async () => {
  const tmp = await mkdtemp(join(tmpdir(), "inject-reminders-bench-"));
  const fixture = makeSessionFixture(tmp);

  const configLayer = Layer.succeed(Config, {
    root: fixture.root,
    configPath: fixture.configPath,
    outDir: fixture.outDir,
    socketPath: join(fixture.root, ".anakmagang", "events.sock"),
    projectName: "test-project",
    webSocketPath: join(fixture.root, ".anakmagang", "events.sock"),
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
  });

  const eventLogLayer = EventLog.bare.pipe(Layer.provide(configLayer));
  const bridgeLayer = Bridge.layer.pipe(Layer.provide(eventLogLayer));

  const memDirs: readonly MemoryDir[] = [{ path: join(tmp, "memories"), source: "permanent" }];
  const memoryLayer = MemoryStore.layerFrom(memDirs);

  const experimentalLayer = Layer.succeed(ExperimentalFeatures, {
    enabledPrompts: ["Experimental prompt A", "Experimental prompt B"],
  });

  const fullLayer = Layer.mergeAll(
    eventLogLayer,
    bridgeLayer,
    memoryLayer,
    experimentalLayer,
    configLayer,
  ).pipe(Layer.provideMerge(BunServices.layer));

  const sid = SessionId("01BENCH000000000000000000IR");

  await Effect.runPromise(
    (
      Effect.gen(function* () {
        const eventLog = yield* EventLog;
        yield* eventLog.createSession(sid);
        yield* eventLog.appendManifest(sid, {
          type: "task_start",
          task: "implement memory store with keyword extraction and schema validation",
          size: "MEDIUM",
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "phase_advance",
          phase: "setup",
          reflection: "assumptions checked",
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "observation",
          text: "found error in schema validation layer",
          ts: new Date().toISOString(),
        });
        yield* eventLog.appendManifest(sid, {
          type: "observation",
          text: "blocked by missing dependency resolution",
          ts: new Date().toISOString(),
        });

        const bridge = yield* Bridge;
        yield* bridge.upsert(sid, "claude", "bench-claude-session", {});
      }) as Effect.Effect<void>
    ).pipe(Effect.provide(fullLayer)),
  );

  await Effect.runPromise(
    (
      Effect.gen(function* () {
        const store = yield* MemoryStore;
        yield* store.create({
          name: "memory-store-patterns",
          description: "Patterns for memory store implementation",
          type: "project",
          scale: "learning",
          tags: ["memory", "store", "patterns"],
          body: "Use atomic writes for all file operations. Always validate with Schema.",
          source: "permanent",
        });
        yield* store.create({
          name: "schema-validation-quirks",
          description: "Schema validation edge cases and workarounds",
          type: "reference",
          scale: "learning",
          tags: ["schema", "validation"],
          body: "decodeUnknownEffect handles async validation gracefully.",
          source: "permanent",
        });
        yield* store.create({
          name: "keyword-extraction-findings",
          description: "Findings about keyword extraction performance",
          type: "feedback",
          scale: "principle",
          tags: ["keyword", "extraction"],
          body: "Stop words must be filtered before matching to avoid noise.",
          source: "permanent",
        });
      }) as Effect.Effect<void>
    ).pipe(Effect.provide(fullLayer)),
  );

  return { fullLayer };
};

const { fullLayer } = await setupLayers();

const guardConfig: GuardConfig = {
  type: "inject-reminders",
  event: "UserPromptSubmit",
  reminders: ["Always run /orchestrate first"],
};

const baseEnv: HookEnv = {
  CLAUDE_PROJECT_DIR: CWD,
  CLAUDE_AGENT_NAME: "effect-ts",
};

const inputWithSession: HookInput = {
  tool_name: "Bash",
  tool_input: { command: "echo hello" },
  session_id: "bench-claude-session",
  context_window: { used_percentage: 45 },
};

const inputWithoutSession: HookInput = {
  tool_name: "Bash",
  tool_input: { command: "echo hello" },
  session_id: "nonexistent-session-id",
  context_window: { used_percentage: 45 },
};

const ctxWithSession: GuardContext = {
  input: inputWithSession,
  env: baseEnv,
  guard: guardConfig,
};

const ctxWithoutSession: GuardContext = {
  input: inputWithoutSession,
  env: baseEnv,
  guard: guardConfig,
};

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(effect.pipe(Effect.provide(fullLayer)) as Effect.Effect<A>);

describe("inject-reminders", () => {
  test("full evaluation with all services (active session)", async () => {
    await measureAsync("full evaluation with all services (active session)", async () => {
      await run(injectReminders(ctxWithSession));
    });
  });

  test("with active session (session resolution + EventLog + memory + keywords)", async () => {
    await measureAsync(
      "with active session (session resolution + EventLog + memory + keywords)",
      async () => {
        await run(injectReminders(ctxWithSession));
      },
    );
  });

  test("without active session (fast path)", async () => {
    await measureAsync("without active session (fast path)", async () => {
      await run(injectReminders(ctxWithoutSession));
    });
  });
});
