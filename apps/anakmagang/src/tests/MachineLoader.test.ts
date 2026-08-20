import { describe, test, expect } from "bun:test";
import { Effect, Exit, Schema } from "effect";
import { MachineLoader, MachineConfig, configToYaml } from "../MachineLoader";
import * as Yaml from "../Yaml";

const loadPreset = (name: string) =>
  Effect.gen(function* () {
    const loader = yield* MachineLoader;
    return yield* loader.loadPreset(name);
  }).pipe(Effect.provide(MachineLoader.layer));

describe("MachineLoader.loadPreset", () => {
  test("known preset orchestrate succeeds with 16 phases", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect(result.phases.length).toBe(16);
  });

  test("unknown preset fails with MachineLoadError", async () => {
    const exit = await Effect.runPromiseExit(loadPreset("nonexistent"));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  test("config name matches preset name", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect(result.name).toBe("orchestrate");
  });

  test("all phases have required fields", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    for (const phase of result.phases) {
      expect(typeof phase.id).toBe("string");
      expect(phase.id.length).toBeGreaterThan(0);
      expect(typeof phase.name).toBe("string");
      expect(phase.name.length).toBeGreaterThan(0);
      expect(typeof phase.exit_question).toBe("string");
      expect(phase.exit_question.length).toBeGreaterThan(0);
      expect(phase.next === null || typeof phase.next === "string").toBe(true);
    }
  });
});

describe("Store schema round-trip", () => {
  const decode = Schema.decodeUnknownSync(MachineConfig);

  const baseConfig = (stores: ReadonlyArray<unknown>) => ({
    name: "test",
    version: 1,
    ground: { stores },
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
  });

  test("Slot store decodes correctly", () => {
    const result = decode(
      baseConfig([{ kind: "Slot", name: "test", per: "singleton", tracks: { x: "set" } }]),
    );
    expect(result.ground.stores[0].kind).toBe("Slot");
    expect(result.ground.stores[0].name).toBe("test");
  });

  test("Memory store decodes correctly", () => {
    const result = decode(baseConfig([{ kind: "Memory", name: "test", path: ".mem", budget: 5 }]));
    expect(result.ground.stores[0].kind).toBe("Memory");
  });

  test("Artifact store decodes correctly", () => {
    const result = decode(
      baseConfig([{ kind: "Artifact", name: "test", path: ".out", writable: true }]),
    );
    expect(result.ground.stores[0].kind).toBe("Artifact");
  });
});

describe("Preset v2 structure", () => {
  test("ground.stores has 5 entries", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect(result.ground.stores.length).toBe(5);
  });

  test("store kinds distribution: 2 Slots, 1 Memory, 2 Artifacts", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    const kinds = result.ground.stores.map((s) => s.kind);
    expect(kinds.filter((k) => k === "Slot").length).toBe(2);
    expect(kinds.filter((k) => k === "Memory").length).toBe(1);
    expect(kinds.filter((k) => k === "Artifact").length).toBe(2);
  });

  test("ground.flows has 1 entry", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect(result.ground.flows).toBeDefined();
    if (!result.ground.flows) return;
    expect(result.ground.flows.length).toBe(1);
  });

  test("runtime.memory.scales has 4 entries", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect(result.runtime.memory.scales.length).toBe(4);
  });

  test("no state or memory top-level keys", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect("state" in result).toBe(false);
    expect("memory" in result).toBe(false);
  });
});

describe("configToYaml round-trip", () => {
  test("serialize then parse back produces equivalent config", async () => {
    const original = await Effect.runPromise(loadPreset("orchestrate"));
    const yamlAst = configToYaml(original);
    const yamlStr = Yaml.prettyPrintDoc(Yaml.doc(yamlAst));
    const parsed = Yaml.parse(yamlStr);
    const roundTripped = Schema.decodeUnknownSync(MachineConfig)(parsed);
    expect(roundTripped.name).toBe(original.name);
    expect(roundTripped.version).toBe(original.version);
    expect(roundTripped.phases.length).toBe(original.phases.length);
    expect(roundTripped.ground.stores.length).toBe(original.ground.stores.length);
    expect(roundTripped.ground.flows).toBeDefined();
    expect(original.ground.flows).toBeDefined();
    if (!roundTripped.ground.flows || !original.ground.flows) return;
    expect(roundTripped.ground.flows.length).toBe(original.ground.flows.length);
    expect(roundTripped.runtime.memory.scales).toEqual(original.runtime.memory.scales);
  });
});

describe("Size presets include criteria", () => {
  test("TRIVIAL criteria is defined and has entries", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    expect(result.size_presets).toBeDefined();
    if (!result.size_presets) return;
    const trivial = result.size_presets["TRIVIAL"];
    expect(trivial).toBeDefined();
    expect(trivial.criteria).toBeDefined();
    if (!trivial.criteria) return;
    expect(trivial.criteria.length).toBeGreaterThan(0);
  });

  test("all size presets have criteria", async () => {
    const result = await Effect.runPromise(loadPreset("orchestrate"));
    if (!result.size_presets) return;
    for (const [, preset] of Object.entries(result.size_presets)) {
      expect(preset.criteria).toBeDefined();
      if (!preset.criteria) continue;
      expect(preset.criteria.length).toBeGreaterThan(0);
    }
  });

  test("criteria survives YAML round-trip", async () => {
    const original = await Effect.runPromise(loadPreset("orchestrate"));
    const yamlStr = Yaml.prettyPrintDoc(Yaml.doc(configToYaml(original)));
    const roundTripped = Schema.decodeUnknownSync(MachineConfig)(Yaml.parse(yamlStr));
    if (!roundTripped.size_presets || !original.size_presets) return;
    if (
      !roundTripped.size_presets["TRIVIAL"].criteria ||
      !original.size_presets["TRIVIAL"].criteria
    )
      return;
    expect(roundTripped.size_presets["TRIVIAL"].criteria).toEqual(
      original.size_presets["TRIVIAL"].criteria,
    );
  });
});
