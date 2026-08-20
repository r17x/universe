import { describe, test, expect, afterAll } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { GuardEvaluator, $is, type GuardConfig, type HookInput, type HookEnv } from "../guard";
import { EventLog } from "../EventLog";
import { Config, ConfigNotFound } from "../Config";
import { Bridge } from "../Bridge";
import { Output, silent } from "../protocol.Output";

const tempDir = mkdtempSync(join(tmpdir(), "guard-post-edit-test-"));

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

describe("post-edit", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp",
  };

  const evaluate = (filePath: string | undefined, command: string | undefined) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const guard: GuardConfig =
          command !== undefined
            ? { type: "post-edit", event: "PostToolUse", matcher: "Edit|Write", command }
            : { type: "post-edit", event: "PostToolUse", matcher: "Edit|Write" };
        const input: HookInput =
          filePath !== undefined
            ? { tool_name: "Edit", tool_input: { file_path: filePath } }
            : { tool_name: "Edit", tool_input: {} };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  const evaluateWithFileKey = (filePath: string, command: string) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const guard: GuardConfig = {
          type: "post-edit",
          event: "PostToolUse",
          matcher: "Edit|Write",
          command,
        };
        const input: HookInput = { tool_name: "Write", tool_input: { file: filePath } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("allows when no file_path in tool_input", async () => {
    const result = await evaluate(undefined, "true");
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when file_path is not a string", async () => {
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const guard: GuardConfig = {
          type: "post-edit",
          event: "PostToolUse",
          matcher: "Edit|Write",
          command: "true",
        };
        const input: HookInput = { tool_name: "Edit", tool_input: { file_path: 42 } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when no command configured", async () => {
    const result = await evaluate("/dev/null", undefined);
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when command succeeds", async () => {
    const result = await evaluate("/dev/null", "true");
    expect($is("Allow")(result)).toBe(true);
  });

  test("warns when command fails", async () => {
    const result = await evaluate("/dev/null", "echo error-output >&2 && exit 1");
    expect($is("Warn")(result)).toBe(true);
    expect($is("Warn")(result) ? result.message : "").toContain("post-edit command failed");
    expect($is("Warn")(result) ? result.message : "").toContain("error-output");
  });

  test("substitutes {file} in command", async () => {
    const result = await evaluate("/dev/null", "test -e {file}");
    expect($is("Allow")(result)).toBe(true);
  });

  test("substitution failure surfaces file path in warning", async () => {
    const result = await evaluate("/nonexistent/path.txt", "test -f {file}");
    expect($is("Warn")(result)).toBe(true);
    expect($is("Warn")(result) ? result.message : "").toContain("/nonexistent/path.txt");
  });

  test("reads file key as fallback", async () => {
    const result = await evaluateWithFileKey("/dev/null", "test -e {file}");
    expect($is("Allow")(result)).toBe(true);
  });
});
