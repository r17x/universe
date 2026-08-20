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

const tempDir = mkdtempSync(join(tmpdir(), "guard-agent-stop-test-"));

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

describe("agent-stop", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  const nixVerificationRules = [
    {
      file_pattern: "\\.nix\\b",
      required_commands: ["nix eval", "nix flake check", "nix flake show", "nix fmt", "nixfmt"],
      message:
        "Worker modified .nix files but did not run nix verification.\nRun 'nix flake check --no-build' or 'nix eval' before stopping.",
    },
  ];

  const guard: GuardConfig = {
    type: "agent-stop-guard",
    event: "PostToolUse",
    verification_rules: nixVerificationRules,
  };

  const evaluate = (input: HookInput) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("allows when no .nix mentioned in output", async () => {
    const result = await evaluate({ output: "Modified src/index.ts and ran tests" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks when .nix mentioned without verification", async () => {
    const result = await evaluate({ output: "Edited flake.nix to add new package" });
    expect($is("Block")(result)).toBe(true);
  });

  test("allows when .nix mentioned with nix eval verification", async () => {
    const result = await evaluate({ output: "Edited flake.nix and ran nix eval to verify" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when .nix mentioned with nix flake check verification", async () => {
    const result = await evaluate({
      output: "Edited flake.nix and ran nix flake check --no-build",
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when .nix mentioned with nix flake show", async () => {
    const result = await evaluate({ output: "Updated default.nix then ran nix flake show" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when .nix mentioned with nix fmt", async () => {
    const result = await evaluate({ output: "Changed shell.nix and ran nix fmt" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when .nix mentioned with nixfmt", async () => {
    const result = await evaluate({ output: "Changed shell.nix and ran nixfmt on it" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("reads from output field", async () => {
    const result = await evaluate({ output: "Edited flake.nix without verification" });
    expect($is("Block")(result)).toBe(true);
  });

  test("falls back to transcript field", async () => {
    const result = await evaluate({ transcript: "Edited flake.nix without verification" });
    expect($is("Block")(result)).toBe(true);
  });

  test("falls back to result field", async () => {
    const result = await evaluate({ result: "Edited flake.nix without verification" });
    expect($is("Block")(result)).toBe(true);
  });

  test("allows when all fields empty", async () => {
    const result = await evaluate({});
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks when .nix in transcript without verification", async () => {
    const result = await evaluate({ transcript: "Modified default.nix" });
    expect($is("Block")(result)).toBe(true);
  });

  test("handles multiple .nix references with single verification", async () => {
    const result = await evaluate({
      output: "Edited flake.nix and default.nix, then ran nix eval",
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("word boundary: allows nixpkgs without .nix (no false positive)", async () => {
    const result = await evaluate({ output: "Cloned nixpkgs repository and built packages" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when .nix only mentioned in prose without file context", async () => {
    const result = await evaluate({ output: "I think we should look at the .nix configuration" });
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks when .nix appears in file path without verification", async () => {
    const result = await evaluate({ output: "Edit flake.nix\nChanged the inputs section" });
    expect($is("Block")(result)).toBe(true);
  });

  test("allows when command appears in execution context", async () => {
    const result = await evaluate({
      output: "Edited path/to/flake.nix\n$ nix eval .#check\nresult: ok",
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks when command only appears as intent", async () => {
    const result = await evaluate({ output: "Edited path/to/flake.nix\nI should run nix eval" });
    expect($is("Block")(result)).toBe(true);
  });

  const guardWithPromises: GuardConfig = {
    type: "agent-stop-guard",
    event: "PostToolUse",
    verification_rules: nixVerificationRules,
    promises: [
      "IMPLEMENTATION_COMPLETE",
      "VERIFICATION_PASSED",
      "VERIFICATION_FAILED",
      "IMPLEMENTATION_BLOCKED",
      "NEEDS_COORDINATOR_INPUT",
    ],
  };

  const evaluateWithPromises = (input: HookInput) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input, env, guard: guardWithPromises });
      }),
    );

  test("warns when promises configured but none found in output", async () => {
    const result = await evaluateWithPromises({ output: "Done with the task, all good." });
    expect($is("Warn")(result)).toBe(true);
  });

  test("allows when promise found in output", async () => {
    const result = await evaluateWithPromises({
      output: "All changes applied.\n\nIMPLEMENTATION_COMPLETE",
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when no promises configured (backward compat)", async () => {
    const result = await evaluate({ output: "Done with the task, all good." });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when promises configured but output is empty (backgrounded agent)", async () => {
    const result = await evaluateWithPromises({});
    expect($is("Allow")(result)).toBe(true);
  });

  test("warns when promises configured and output is explicitly empty string", async () => {
    const result = await evaluateWithPromises({ output: "" });
    expect($is("Warn")(result)).toBe(true);
  });

  test("warns when nix verified but no promise", async () => {
    const result = await evaluateWithPromises({
      output: "Edited flake.nix and ran nix eval to verify",
    });
    expect($is("Warn")(result)).toBe(true);
  });

  test("blocks when .nix without verification even with promise", async () => {
    const result = await evaluateWithPromises({
      output: "Edited flake.nix\n\nIMPLEMENTATION_COMPLETE",
    });
    expect($is("Block")(result)).toBe(true);
  });
});
