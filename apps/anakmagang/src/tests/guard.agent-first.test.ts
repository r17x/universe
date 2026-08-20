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

const tempDir = mkdtempSync(join(tmpdir(), "guard-agent-first-test-"));

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

describe("agent-first", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  const guard: GuardConfig = {
    type: "agent-first",
    event: "PreToolUse",
    matcher: "Edit|Write",
    routes: { ".nix": "/gateway-nix" },
  };

  const evaluate = (input: HookInput) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("blocks Edit without agent_id", async () => {
    const result = await evaluate({ tool_name: "Edit", tool_input: { file_path: "/tmp/test.ts" } });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks Write without agent_id", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test.ts" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("allows Edit with agent_id", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/test.ts" },
      agent_id: "effect-ts",
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows Write with agent_id", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test.ts" },
      agent_id: "effect-ts",
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks with empty string agent_id", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/test.ts" },
      agent_id: "",
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("block message includes gateway-nix for .nix files", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/test.nix" },
    });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("gateway-nix");
  });

  test("block message includes worker agent for non-.nix files", async () => {
    const result = await evaluate({ tool_name: "Edit", tool_input: { file_path: "/tmp/test.ts" } });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("worker agent");
  });

  test("block message includes the tool name", async () => {
    const result = await evaluate({ tool_name: "Edit", tool_input: { file_path: "/tmp/test.ts" } });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("Edit");
  });

  test("block message includes the file path", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/my-file.ts" },
    });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("/tmp/my-file.ts");
  });

  test("uses file_path field", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/specific.ts" },
    });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("/tmp/specific.ts");
  });

  test("falls back to file field when file_path missing", async () => {
    const result = await evaluate({ tool_name: "Edit", tool_input: { file: "/tmp/fallback.ts" } });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("/tmp/fallback.ts");
  });
});
