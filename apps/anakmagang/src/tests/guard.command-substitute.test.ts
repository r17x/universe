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

const tempDir = mkdtempSync(join(tmpdir(), "guard-command-substitute-test-"));

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

describe("command-substitute", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  const singleRuleGuard: GuardConfig = {
    type: "command-substitute",
    event: "PreToolUse",
    matcher: "Bash",
    rules: [{ contains: ["npm", "pnpm", "yarn"], should: "bun" }],
  };

  const evaluate = (command: string, guard: GuardConfig = singleRuleGuard) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Bash", tool_input: { command } };
        return yield* evaluator.evaluate({ input, env, guard });
      }),
    );

  test("blocks npm and suggests bun", async () => {
    const result = await evaluate("npm install react");
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("npm");
    expect($is("Block")(result) ? result.message : "").toContain("bun");
  });

  test("blocks npx and suggests bunx", async () => {
    const npxGuard: GuardConfig = {
      type: "command-substitute",
      event: "PreToolUse",
      matcher: "Bash",
      rules: [{ contains: ["npx", "pnpx"], should: "bunx" }],
    };
    const result = await evaluate("npx create-react-app", npxGuard);
    expect($is("Block")(result)).toBe(true);
    expect($is("Block")(result) ? result.message : "").toContain("npx");
    expect($is("Block")(result) ? result.message : "").toContain("bunx");
  });

  test("allows bun commands", async () => {
    const result = await evaluate("bun install react");
    expect($is("Allow")(result)).toBe(true);
  });

  test("with no rules allows everything", async () => {
    const noRulesGuard: GuardConfig = {
      type: "command-substitute",
      event: "PreToolUse",
      matcher: "Bash",
    };
    const result = await evaluate("npm install", noRulesGuard);
    expect($is("Allow")(result)).toBe(true);
  });
});

describe("command-substitute scalability", () => {
  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  };

  const commandSubstituteGuard: GuardConfig = {
    type: "command-substitute",
    event: "PreToolUse",
    matcher: "Bash",
    rules: [
      { contains: ["npm", "pnpm", "yarn"], should: "bun" },
      { contains: ["npx", "pnpx"], should: "bunx" },
    ],
  };

  const evaluate = (command: string) =>
    run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator;
        const input: HookInput = { tool_name: "Bash", tool_input: { command } };
        return yield* evaluator.evaluate({ input, env, guard: commandSubstituteGuard });
      }),
    );

  const shouldBlock = [
    ["direct command", "npm install"],
    ["after pipe", "ls | npm install"],
    ["after semicolon", "ls; npm install"],
    ["after &&", "ls && npm install"],
    ["after ||", "ls || npm install"],
    ["command substitution", "$(npm version)"],
    ["subshell", "(npm install)"],
    ["backtick substitution", "`npm version`"],
    ["sudo wrapper", "sudo npm install"],
    ["env wrapper", "env npm install"],
    ["exec wrapper", "exec npm install"],
    ["xargs wrapper", "xargs npm install"],
    ["doas wrapper", "doas npm install"],
    ["nohup wrapper", "nohup npm install &"],
    ["time wrapper", "time npm install"],
    ["nice wrapper", "nice npm install"],
    ["env var prefix", "FOO=bar npm install"],
    ["multiple env vars", "FOO=bar BAZ=qux npm install"],
    ["env var + wrapper", "FOO=bar sudo npm install"],
    ["chained wrappers", "sudo env npm install"],
    ["after semicolon + wrapper", "ls; sudo npm install"],
    ["after && + wrapper", "true && env npm install"],
    ["after || + wrapper", "false || exec npm install"],
    ["after pipe + wrapper", "ls | xargs npm install"],
    ["yarn add", "yarn add react"],
    ["pnpm install", "pnpm install"],
    ["npx create-app", "npx create-app"],
    ["pnpx create-app", "pnpx create-app"],
    ["env var + yarn", "NODE_ENV=production yarn build"],
    ["chained blocked", "npm install; npx create-app"],
  ] as const;

  const shouldAllow = [
    ["allowed command", "bun install"],
    ["pattern as argument", "echo npm is bad"],
    ["pattern in quoted arg", 'anakmagang start "fix npm"'],
    ["pattern in commit msg", 'git commit -m "replace npm"'],
    ["partial word", "npmrc-config check"],
    ["pattern as grep arg", "grep npm package.json"],
    ["pattern as cat arg", "cat npm-debug.log"],
    ["pattern in echo", 'echo "use bunx instead of npx"'],
    ["pattern after man", "man npm"],
    ["pattern after which", "which npm"],
    ["pattern after type", "type npm"],
    ["URL containing pattern", "curl https://registry.npm.org/foo"],
  ] as const;

  for (const [label, cmd] of shouldBlock) {
    test(`blocks ${label}: ${cmd}`, async () => {
      const result = await evaluate(cmd);
      expect($is("Block")(result)).toBe(true);
    });
  }

  for (const [label, cmd] of shouldAllow) {
    test(`allows ${label}: ${cmd}`, async () => {
      const result = await evaluate(cmd);
      expect($is("Allow")(result)).toBe(true);
    });
  }
});
