import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  GuardEvaluator,
  matchesTool,
  $is,
  type GuardConfig,
  type HookInput,
  type HookEnv,
} from "../guard";
import { EventLog } from "../EventLog";
import { Config, ConfigNotFound } from "../Config";
import { Bridge } from "../Bridge";
import { Output, silent } from "../protocol.Output";

const tempDir = mkdtempSync(join(tmpdir(), "guard-test-"));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const testConfig = {
  root: tempDir,
  configPath: join(tempDir, "config.yaml"),
  outDir: join(tempDir, "out"),
  socketPath: join(tempDir, ".anakmagang", "events.sock"),
  projectName: "test",
  webSocketPath: join(tempDir, ".anakmagang", "web-events.sock"),
  readConfig: Effect.fail(new ConfigNotFound({ path: "test", message: "test" })),
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
};

const testConfigLayer = Layer.succeed(Config, testConfig);
const EventLogLayer = EventLog.bare.pipe(
  Layer.provideMerge(testConfigLayer),
  Layer.provideMerge(BunServices.layer),
);
const TestLayer = GuardEvaluator.bare.pipe(
  Layer.provide(Bridge.layer),
  Layer.provide(testConfigLayer),
  Layer.provideMerge(EventLogLayer),
  Layer.provideMerge(Output.withFormat(silent)),
  Layer.provideMerge(BunServices.layer),
);

describe("matchesTool", () => {
  test("undefined matcher matches everything", () => {
    expect(matchesTool(undefined, "Edit")).toBe(true);
  });

  test("empty matcher matches everything", () => {
    expect(matchesTool("", "Edit")).toBe(true);
  });

  test("pipe-separated patterns match substring", () => {
    expect(matchesTool("Edit|Write", "Edit")).toBe(true);
    expect(matchesTool("Edit|Write", "Write")).toBe(true);
    expect(matchesTool("Edit|Write", "Bash")).toBe(false);
  });

  test("undefined tool name doesn't match", () => {
    expect(matchesTool("Edit", undefined)).toBe(false);
  });
});

describe("GuardEvaluator", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  test("evaluateAll filters by event and matcher", async () => {
    const guards: GuardConfig[] = [
      { type: "agent-first", event: "PreToolUse", matcher: "Edit|Write" },
      { type: "block-nix-build", event: "PreToolUse", matcher: "Bash" },
    ];
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "echo hello" } };
    const results = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluateAll(guards, "PreToolUse", undefined, input, env);
      }),
    );
    expect(results.results.length).toBe(1);
    expect($is("Allow")(results.results[0])).toBe(true);
  });

  test("evaluateAll short-circuits on Block", async () => {
    const guards: GuardConfig[] = [
      { type: "agent-first", event: "PreToolUse", matcher: "Edit" },
      { type: "output-location", event: "PreToolUse", matcher: "Edit" },
    ];
    const input: HookInput = {
      tool_name: "Edit",
      tool_input: { file_path: "/outside/project/file.ts" },
    };
    const results = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluateAll(guards, "PreToolUse", undefined, input, env);
      }),
    );
    expect(results.results.length).toBe(1);
    expect($is("Block")(results.results[0])).toBe(true);
  });

  test("unknown guard type returns Allow", async () => {
    const guard: GuardConfig = { type: "nonexistent-guard", event: "PreToolUse" };
    const input: HookInput = { tool_name: "Read" };
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });
});
