import { describe, test } from "bun:test";
import { Effect, Layer, Option, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtempSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GuardEvaluator, HookInputSchema, type HookInput, type HookEnv } from "../../../guard";
import { loadGuards } from "../../../Layers";
import { Config } from "../../../Config";
import { MachineLoader } from "../../../MachineLoader";
import { EventLog } from "../../../EventLog";
import { Bridge } from "../../../Bridge";
import { MemoryStore, type MemoryDir } from "../../../MemoryStore";
import { ExperimentalFeatures } from "../../../ExperimentalFeatures";
import { renderStatusline, type SessionSnapshot } from "../../../StatuslineRenderer";

const ITERATIONS = 10;

const PROJECT_DIR = join(import.meta.dir, "..", "..", "..", "..", "..", "..");

const tempDir = mkdtempSync(join(tmpdir(), "hook-eval-bench-"));
mkdirSync(join(tempDir, ".anakmagang"), { recursive: true });
cpSync(
  join(PROJECT_DIR, ".anakmagang", "config.yaml"),
  join(tempDir, ".anakmagang", "config.yaml"),
);
mkdirSync(join(tempDir, ".anakmagang", "out"), { recursive: true });
mkdirSync(join(tempDir, ".claude", "memories"), { recursive: true });

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const BIN_PATH = join(import.meta.dir, "..", "..", "..", "bin.ts");

const runCli = async (args: ReadonlyArray<string>, stdin?: string): Promise<void> => {
  const proc = Bun.spawn(["bun", "run", BIN_PATH, ...args], {
    cwd: tempDir,
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdin !== undefined ? new Blob([stdin]) : undefined,
  });
  await proc.exited;
};

const bashInput: HookInput = {
  tool_name: "Bash",
  tool_input: { command: "echo hello" },
  session_id: "bench-hook-session",
  context_window: { used_percentage: 45 },
};

const editInput: HookInput = {
  tool_name: "Edit",
  tool_input: { file_path: "src/foo.ts", old_string: "a", new_string: "b" },
  session_id: "bench-hook-session",
  context_window: { used_percentage: 60 },
};

const stopInput: HookInput = {
  session_id: "bench-hook-session",
  context_window: { used_percentage: 30 },
};

const bashStdin = JSON.stringify(bashInput);
const editStdin = JSON.stringify(editInput);
const stopStdin = JSON.stringify(stopInput);

const configLayer = Layer.succeed(Config, {
  root: tempDir,
  configPath: join(tempDir, ".anakmagang", "config.yaml"),
  outDir: join(tempDir, ".anakmagang", "out"),
  socketPath: join(tempDir, ".anakmagang", "events.sock"),
  projectName: "test-project",
  webSocketPath: join(tempDir, ".anakmagang", "events.sock"),
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
const memDirs: readonly MemoryDir[] = [
  { path: join(tempDir, ".claude", "memories"), source: "permanent" },
];
const memoryLayer = MemoryStore.layerFrom(memDirs);
const experimentalLayer = Layer.succeed(ExperimentalFeatures, {
  enabledPrompts: [],
});

const layers = Layer.mergeAll(
  MachineLoader.layer,
  configLayer,
  eventLogLayer,
  GuardEvaluator.layerWithMemory,
  bridgeLayer,
  experimentalLayer,
  memoryLayer,
).pipe(Layer.provideMerge(BunServices.layer));

const run = <A, R>(effect: Effect.Effect<A, unknown, R>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layers)) as Effect.Effect<A>);

const baseEnv: HookEnv = {
  CLAUDE_PROJECT_DIR: tempDir,
  CLAUDE_AGENT_NAME: "effect-ts",
};

describe("Full Hook Pipeline", () => {
  test("UserPromptSubmit with Bash tool", async () => {
    await measureAsync("UserPromptSubmit with Bash tool", async () => {
      await runCli(["hook", "eval", "--event", "UserPromptSubmit"], bashStdin);
    });
  });

  test("UserPromptSubmit with Edit tool (triggers more guards)", async () => {
    await measureAsync("UserPromptSubmit with Edit tool (triggers more guards)", async () => {
      await runCli(["hook", "eval", "--event", "UserPromptSubmit"], editStdin);
    });
  });

  test("Stop event (session-stop-guard path)", async () => {
    await measureAsync("Stop event (session-stop-guard path)", async () => {
      await runCli(["hook", "eval", "--event", "Stop"], stopStdin);
    });
  });
});

describe("Pipeline Stages", () => {
  test("stdin JSON parsing", async () => {
    await measureAsync("stdin JSON parsing", async () => {
      await Schema.decodeUnknownPromise(Schema.fromJsonString(HookInputSchema))(bashStdin);
    });
  });

  test("session resolution (loadGuards)", async () => {
    await measureAsync("session resolution (loadGuards)", async () => {
      await run(loadGuards);
    });
  });

  test("guard chain evaluation (evaluateAll)", async () => {
    await measureAsync("guard chain evaluation (evaluateAll)", async () => {
      await run(
        Effect.gen(function* () {
          const evaluator = yield* GuardEvaluator;
          const guards = yield* loadGuards;
          return yield* evaluator.evaluateAll(
            guards,
            "UserPromptSubmit",
            undefined,
            editInput,
            baseEnv,
          );
        }),
      );
    });
  });

  test("statusline rendering", () => {
    measure("statusline rendering", () => {
      const state: Option.Option<SessionSnapshot> = Option.some({
        sessionId: "bench-session",
        task: "benchmark the hook eval pipeline",
        phase: "implementation",
      });
      renderStatusline(undefined, bashInput, state, false);
    });
  });
});
