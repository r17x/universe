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

const tempDir = mkdtempSync(join(tmpdir(), "guard-reflection-required-test-"));

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

describe("reflection-required", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  const guard: GuardConfig = { type: "reflection-required", event: "PreToolUse" };

  const makeInput = (command: string): HookInput => ({
    tool_name: "Bash",
    tool_input: { command },
  });

  const evaluate = (input: HookInput) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("allows non-eval command", async () => {
    const result = await evaluate(makeInput("ls -la"));
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows command without anakmagang eval", async () => {
    const result = await evaluate(makeInput("git status && echo hello"));
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows valid reflection with sufficient words", async () => {
    const result = await evaluate(
      makeInput(
        'anakmagang eval "I checked auth module and found the issue was in permissions" --session abc',
      ),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows valid multi-word reflection", async () => {
    const result = await evaluate(
      makeInput('anakmagang eval "search was broad enough" --session abc'),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("blocks empty reflection with double quotes", async () => {
    const result = await evaluate(makeInput('anakmagang eval "" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks empty reflection with single quotes", async () => {
    const result = await evaluate(makeInput("anakmagang eval '' --session abc"));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks filler word: done", async () => {
    const result = await evaluate(makeInput('anakmagang eval "done" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks filler word: ok", async () => {
    const result = await evaluate(makeInput('anakmagang eval "ok" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks filler word: yes", async () => {
    const result = await evaluate(makeInput('anakmagang eval "yes" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks filler word: n/a", async () => {
    const result = await evaluate(makeInput('anakmagang eval "n/a" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks too short reflection (2 words)", async () => {
    const result = await evaluate(makeInput('anakmagang eval "looks good" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("blocks too short reflection (1 word non-filler)", async () => {
    const result = await evaluate(makeInput('anakmagang eval "fine" --session abc'));
    expect($is("Block")(result)).toBe(true);
  });

  test("allows reflection with embedded single quotes in double-quoted string", async () => {
    const result = await evaluate(
      makeInput("anakmagang eval \"I checked the 'auth' module and it's fine\" --session abc"),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("allows reflection with embedded double quotes in single-quoted string", async () => {
    const result = await evaluate(
      makeInput("anakmagang eval 'The \"old\" approach was wrong, tried new one' --session abc"),
    );
    expect($is("Allow")(result)).toBe(true);
  });

  test("handles reflection followed by multiple flags", async () => {
    const result = await evaluate(
      makeInput(
        'anakmagang eval "searched broadly enough for patterns" --session abc --size MEDIUM',
      ),
    );
    expect($is("Allow")(result)).toBe(true);
  });
});
