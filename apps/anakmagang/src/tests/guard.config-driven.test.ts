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

const tempDir = mkdtempSync(join(tmpdir(), "guard-config-driven-test-"));

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

const env: HookEnv = { CLAUDE_PROJECT_DIR: "/tmp/test-project" };

const evaluate = (input: HookInput, guard: GuardConfig) =>
  run(
    Effect.gen(function* () {
      const evaluator = yield* GuardEvaluator;
      return yield* evaluator.evaluate({ input, env, guard });
    }),
  );

describe("agent-first with routes config", () => {
  const routedGuard: GuardConfig = {
    type: "agent-first",
    event: "PreToolUse",
    matcher: "Edit|Write",
    routes: { ".nix": "/gateway-nix", ".rs": "/gateway-rust" },
  };

  test("with routes config, .nix file gets route-specific suggestion", async () => {
    const result = await evaluate(
      { tool_name: "Edit", tool_input: { file_path: "foo.nix" } },
      routedGuard,
    );
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("/gateway-nix");
  });

  test("with routes config, unknown extension gets generic suggestion", async () => {
    const result = await evaluate(
      { tool_name: "Edit", tool_input: { file_path: "foo.py" } },
      routedGuard,
    );
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain(
      "Delegate to the appropriate worker agent",
    );
  });

  test("without routes config, always generic suggestion (backward compat)", async () => {
    const noRoutesGuard: GuardConfig = {
      type: "agent-first",
      event: "PreToolUse",
      matcher: "Edit|Write",
    };
    const result = await evaluate(
      { tool_name: "Edit", tool_input: { file_path: "foo.nix" } },
      noRoutesGuard,
    );
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain(
      "Delegate to the appropriate worker agent",
    );
  });

  test("with agent_id set, always Allow regardless of routes", async () => {
    const result = await evaluate(
      { tool_name: "Edit", tool_input: { file_path: "foo.nix" }, agent_id: "worker-1" },
      routedGuard,
    );
    expect($is("Allow")(result)).toBe(true);
  });
});

describe("agent-stop-guard with verification_rules", () => {
  const verificationGuard: GuardConfig = {
    type: "agent-stop-guard",
    verification_rules: [
      {
        file_pattern: "\\.nix\\b",
        required_commands: ["nix eval", "nix flake check"],
        message: "Run nix verification before stopping.",
      },
    ],
    promises: ["IMPLEMENTATION_COMPLETE"],
  };

  test("blocks when file pattern matched but no verification command found", async () => {
    const result = await evaluate({ output: "edited foo.nix and bar.nix" }, verificationGuard);
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("Run nix verification");
  });

  test("allows when verification command is found", async () => {
    const result = await evaluate(
      { output: "edited foo.nix\nran nix flake check\nIMPLEMENTATION_COMPLETE" },
      verificationGuard,
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("without verification_rules, no file-based checks (only promises)", async () => {
    const promisesOnlyGuard: GuardConfig = {
      type: "agent-stop-guard",
      promises: ["DONE"],
    };
    const result = await evaluate(
      { output: "edited foo.nix without verification but DONE" },
      promisesOnlyGuard,
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("without verification_rules AND without promises, Allow", async () => {
    const bareGuard: GuardConfig = { type: "agent-stop-guard" };
    const result = await evaluate({ output: "anything" }, bareGuard);
    expect($is("Allow")(result)).toBe(true);
  });
});

describe("output-location with config-driven restrictions", () => {
  const restrictedGuard: GuardConfig = {
    type: "output-location",
    restricted_paths: ["secrets/secret.yaml", ".sops.yaml"],
    restricted_prefixes: ["result/"],
  };

  test("blocks paths from restricted_paths config", async () => {
    const result = await evaluate(
      {
        tool_name: "Write",
        tool_input: { file_path: join("/tmp/test-project", "secrets/secret.yaml") },
      },
      restrictedGuard,
    );
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks paths from restricted_prefixes config", async () => {
    const result = await evaluate(
      {
        tool_name: "Write",
        tool_input: { file_path: join("/tmp/test-project", "result/some-file") },
      },
      restrictedGuard,
    );
    expect($is("Block")(result)).toBe(true);
  });

  test(".git/ is always blocked even without config", async () => {
    const bareGuard: GuardConfig = { type: "output-location" };
    const result = await evaluate(
      { tool_name: "Write", tool_input: { file_path: join("/tmp/test-project", ".git/config") } },
      bareGuard,
    );
    expect($is("Block")(result)).toBe(true);
  });

  test("without restricted_paths config, only .git/ blocked", async () => {
    const bareGuard: GuardConfig = { type: "output-location" };
    const result = await evaluate(
      {
        tool_name: "Write",
        tool_input: { file_path: join("/tmp/test-project", "secrets/secret.yaml") },
      },
      bareGuard,
    );
    expect($is("Allow")(result)).toBe(true);
  });
});
