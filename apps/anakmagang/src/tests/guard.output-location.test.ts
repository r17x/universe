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

const tempDir = mkdtempSync(join(tmpdir(), "guard-output-location-test-"));

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

describe("output-location", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  const guard: GuardConfig = {
    type: "output-location",
    event: "PreToolUse",
    matcher: "Edit|Write",
    restricted_paths: ["secrets/secret.yaml", ".sops.yaml"],
    restricted_prefixes: ["result/"],
  };

  const evaluate = (input: HookInput) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("allows writes inside project directory", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test-project/src/index.ts" },
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks writes outside project directory", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/home/user/malicious.ts" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks absolute path outside project", async () => {
    const result = await evaluate({ tool_name: "Edit", tool_input: { file_path: "/etc/passwd" } });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks relative path that escapes (../../etc/passwd)", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file_path: "../../etc/passwd" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks secrets/secret.yaml", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test-project/secrets/secret.yaml" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks .sops.yaml", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test-project/.sops.yaml" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks .git/ paths", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test-project/.git/config" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks result/ paths", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test-project/result/bin/app" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("allows normal .ts files", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/test-project/src/app.ts" },
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows nested project paths", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test-project/apps/foo/bar/baz.ts" },
    });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when file_path is undefined", async () => {
    const result = await evaluate({ tool_name: "Write", tool_input: {} });
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows when file_path is not a string", async () => {
    const result = await evaluate({ tool_name: "Write", tool_input: { file_path: 42 } });
    expect($is("Allow")(result)).toBe(true);
  });

  test("uses file field as fallback", async () => {
    const result = await evaluate({
      tool_name: "Edit",
      tool_input: { file: "/home/user/outside.ts" },
    });
    expect($is("Block")(result)).toBe(true);
  });

  test("block message includes the path", async () => {
    const result = await evaluate({
      tool_name: "Write",
      tool_input: { file_path: "/outside/project/file.ts" },
    });
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("/outside/project/file.ts");
  });
});
