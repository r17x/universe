import { describe, test, expect, afterAll } from "bun:test";
import { Array as Arr, Effect, Layer, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ExperimentalCapability, MachineConfig } from "../Machine";
import { ExperimentalFeatures } from "../ExperimentalFeatures";
import { Config, ConfigNotFound } from "../Config";
import { MachineLoader } from "../MachineLoader";

const tempDir = mkdtempSync(join(tmpdir(), "experimental-test-"));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const minimalConfigYaml = (experimentalBlock: string) => `
name: test
version: 1
ground:
  stores:
    - kind: Slot
      name: test
      per: singleton
      tracks:
        x: set
runtime:
  memory:
    scales: [a]
    states: [ACTIVE]
    stale_thresholds: {}
    promotion:
      min_sources: 1
      auto: false
    graph:
      edge_types: []
      max_depth: 1
      max_fan_out: 1
      max_query_nodes: 1
phases:
  - id: x
    name: X
    exit_question: "?"
    next: null
${experimentalBlock}
`;

const writeConfig = (dir: string, experimentalBlock: string) => {
  const configDir = join(dir, ".anakmagang");
  mkdirSync(configDir, { recursive: true });
  const configPath = join(configDir, "config.yaml");
  writeFileSync(configPath, minimalConfigYaml(experimentalBlock));
  return configPath;
};

const makeTestConfig = (dir: string, configPath: string) => ({
  root: dir,
  configPath,
  outDir: join(dir, "out"),
  socketPath: join(dir, ".anakmagang", "events.sock"),
  projectName: "test",
  webSocketPath: join(dir, ".anakmagang", "web-events.sock"),
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
});

const buildTestLayer = (dir: string, configPath: string) => {
  const testConfigLayer = Layer.succeed(Config, makeTestConfig(dir, configPath));
  return Layer.effect(
    ExperimentalFeatures,
    Effect.gen(function* () {
      const config = yield* Config;
      const loader = yield* MachineLoader;
      const machine = yield* loader.loadFromFile(config.configPath);
      const experimental = machine.experimental ?? [];
      const enabledPrompts = Arr.map(
        Arr.filter(experimental, (e) => e.enabled),
        (e) => e.prompt,
      );
      return { enabledPrompts };
    }),
  ).pipe(
    Layer.provide(testConfigLayer),
    Layer.provide(MachineLoader.layer),
    Layer.provideMerge(BunServices.layer),
  );
};

describe("Schema: ExperimentalCapability", () => {
  const decode = Schema.decodeUnknownSync(ExperimentalCapability);

  test("decodes full input correctly", () => {
    const result = decode({ id: "test", enabled: true, prompt: "do X" });
    expect(result.id).toBe("test");
    expect(result.enabled).toBe(true);
    expect(result.prompt).toBe("do X");
  });

  test("enabled defaults to false when omitted", () => {
    const result = decode({ id: "test", prompt: "do X" });
    expect(result.enabled).toBe(false);
  });

  test("fails when required prompt is missing", () => {
    expect(() => decode({ id: "test" })).toThrow();
  });
});

describe("Schema: MachineConfig accepts experimental field", () => {
  const decode = Schema.decodeUnknownSync(MachineConfig);

  const baseConfig = {
    name: "test",
    version: 1,
    ground: {
      stores: [{ kind: "Slot", name: "test", per: "singleton", tracks: { x: "set" } }],
    },
    runtime: {
      memory: {
        scales: ["a"],
        states: ["ACTIVE"],
        stale_thresholds: {},
        promotion: { min_sources: 1, auto: false },
        graph: { edge_types: [], max_depth: 1, max_fan_out: 1, max_query_nodes: 1 },
      },
    },
    phases: [{ id: "x", name: "X", exit_question: "?", next: null }],
  };

  test("decodes config with experimental field", () => {
    const result = decode({
      ...baseConfig,
      experimental: [{ id: "foo", enabled: true, prompt: "bar" }],
    });
    expect(result.experimental).toBeDefined();
    if (!result.experimental) return;
    expect(result.experimental.length).toBe(1);
    expect(result.experimental[0]?.id).toBe("foo");
    expect(result.experimental[0]?.enabled).toBe(true);
    expect(result.experimental[0]?.prompt).toBe("bar");
  });

  test("decodes config without experimental field", () => {
    const result = decode(baseConfig);
    expect(result.experimental).toBeUndefined();
  });
});

describe("Service: ExperimentalFeatures.enabledPrompts", () => {
  test("resolves only enabled feature prompts", async () => {
    const dir = join(tempDir, "enabled-test");
    const configPath = writeConfig(
      dir,
      `experimental:
  - id: feat-a
    enabled: true
    prompt: "prompt A"
  - id: feat-b
    enabled: false
    prompt: "prompt B"`,
    );

    const TestLayer = buildTestLayer(dir, configPath);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ef = yield* ExperimentalFeatures;
        return ef.enabledPrompts;
      }).pipe(Effect.provide(TestLayer)),
    );

    expect(result).toEqual(["prompt A"]);
  });

  test("returns empty array when no experimental section", async () => {
    const dir = join(tempDir, "no-experimental");
    const configPath = writeConfig(dir, "");

    const TestLayer = buildTestLayer(dir, configPath);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ef = yield* ExperimentalFeatures;
        return ef.enabledPrompts;
      }).pipe(Effect.provide(TestLayer)),
    );

    expect(result).toEqual([]);
  });

  test("returns empty array when all features disabled", async () => {
    const dir = join(tempDir, "all-disabled");
    const configPath = writeConfig(
      dir,
      `experimental:
  - id: feat-a
    enabled: false
    prompt: "prompt A"
  - id: feat-b
    prompt: "prompt B"`,
    );

    const TestLayer = buildTestLayer(dir, configPath);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ef = yield* ExperimentalFeatures;
        return ef.enabledPrompts;
      }).pipe(Effect.provide(TestLayer)),
    );

    expect(result).toEqual([]);
  });

  test("returns multiple prompts when multiple features enabled", async () => {
    const dir = join(tempDir, "multi-enabled");
    const configPath = writeConfig(
      dir,
      `experimental:
  - id: feat-a
    enabled: true
    prompt: "prompt A"
  - id: feat-b
    enabled: true
    prompt: "prompt B"
  - id: feat-c
    enabled: false
    prompt: "prompt C"`,
    );

    const TestLayer = buildTestLayer(dir, configPath);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ef = yield* ExperimentalFeatures;
        return ef.enabledPrompts;
      }).pipe(Effect.provide(TestLayer)),
    );

    expect(result).toEqual(["prompt A", "prompt B"]);
  });
});
