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

const tempDir = mkdtempSync(join(tmpdir(), "guard-generalize-test-"));

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

const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

const env: HookEnv = {
  CLAUDE_PROJECT_DIR: "/tmp/test-project",
};

describe("post-edit with file_pattern", () => {
  const nixOnlyGuard: GuardConfig = {
    type: "post-edit",
    event: "PostToolUse",
    matcher: "Edit|Write",
    file_pattern: "\\.nix$",
    command: "echo verified {file}",
  };

  const noPatternGuard: GuardConfig = {
    type: "post-edit",
    event: "PostToolUse",
    matcher: "Edit|Write",
    command: "echo verified {file}",
  };

  const evaluate = (filePath: string, guard: GuardConfig) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Edit", tool_input: { file_path: filePath } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("runs command for matching .nix file", async () => {
    const result = await evaluate("/tmp/test-project/default.nix", nixOnlyGuard);
    expect($is("Allow")(result)).toBe(true);
  });

  test("skips non-matching files", async () => {
    const result = await evaluate("/tmp/test-project/src/main.ts", nixOnlyGuard);
    expect($is("Allow")(result)).toBe(true);
  });

  test("without file_pattern runs for all files", async () => {
    const result = await evaluate("/tmp/test-project/src/main.ts", noPatternGuard);
    expect($is("Allow")(result)).toBe(true);
  });
});

describe("command-substitute with unless_contains", () => {
  const dryRunGuard: GuardConfig = {
    type: "command-substitute",
    event: "PreToolUse",
    matcher: "Bash",
    rules: [
      {
        contains: ["darwin-rebuild switch"],
        should: "darwin-rebuild switch --dry-run",
        unless_contains: "--dry-run",
      },
    ],
  };

  const noUnlessGuard: GuardConfig = {
    type: "command-substitute",
    event: "PreToolUse",
    matcher: "Bash",
    rules: [{ contains: ["npm"], should: "bun" }],
  };

  const nixInstantiateGuard: GuardConfig = {
    type: "command-substitute",
    event: "PreToolUse",
    matcher: "Bash",
    rules: [{ contains: ["nix-instantiate"], should: "nix eval" }],
  };

  const evaluate = (command: string, guard: GuardConfig) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Bash", tool_input: { command } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("blocks command matching contains", async () => {
    const result = await evaluate("darwin-rebuild switch", dryRunGuard);
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("darwin-rebuild switch");
  });

  test("allows command when unless_contains matches", async () => {
    const result = await evaluate("darwin-rebuild switch --dry-run", dryRunGuard);
    expect($is("Allow")(result)).toBe(true);
  });

  test("existing rules without unless_contains still work", async () => {
    const result = await evaluate("npm install", noUnlessGuard);
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("npm");
    expect($is("Block")(result) ? result.message : "").toContain("bun");
  });

  test("blocks nix-instantiate via contains rule", async () => {
    const result = await evaluate("nix-instantiate ./default.nix", nixInstantiateGuard);
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("nix-instantiate");
    expect($is("Block")(result) ? result.message : "").toContain("nix eval");
  });
});
