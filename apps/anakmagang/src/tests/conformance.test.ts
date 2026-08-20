import { describe, test, expect } from "bun:test";
import { Effect, Schema } from "effect";
import { MachineLoader, MachineConfig, ORCHESTRATE_PRESET } from "../MachineLoader";
import { makeGuardRegistry } from "../guard.registry";
import * as Yaml from "../Yaml";
import * as path from "node:path";
import * as fs from "node:fs";

const CONFIG_PATH = path.resolve(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  ".anakmagang",
  "config.yaml",
);

const loadConfigFromYaml = (): typeof MachineConfig.Type => {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const parsed = Yaml.parse(raw);
  return Schema.decodeUnknownSync(MachineConfig)(parsed);
};

const loadPresetFromService = () =>
  Effect.gen(function* () {
    const loader = yield* MachineLoader;
    return yield* loader.loadPreset("orchestrate");
  }).pipe(Effect.provide(MachineLoader.layer));

describe("Conformance: ORCHESTRATE_PRESET matches config.yaml", () => {
  const config = loadConfigFromYaml();

  test("phase count matches", () => {
    expect(ORCHESTRATE_PRESET.phases.length).toBe(config.phases.length);
  });

  test("phase IDs match in order", () => {
    const presetIds = ORCHESTRATE_PRESET.phases.map((p) => p.id);
    const configIds = config.phases.map((p) => p.id);
    expect(presetIds).toEqual(configIds);
  });

  test("phase names match in order", () => {
    const presetNames = ORCHESTRATE_PRESET.phases.map((p) => p.name);
    const configNames = config.phases.map((p) => p.name);
    expect(presetNames).toEqual(configNames);
  });

  test("phase exit questions match", () => {
    for (const configPhase of config.phases) {
      const presetPhase = ORCHESTRATE_PRESET.phases.find((p) => p.id === configPhase.id);
      expect(presetPhase).toBeDefined();
      if (!presetPhase) continue;
      expect(presetPhase.exit_question).toBe(configPhase.exit_question);
    }
  });

  test("phase next pointers match", () => {
    for (const configPhase of config.phases) {
      const presetPhase = ORCHESTRATE_PRESET.phases.find((p) => p.id === configPhase.id);
      expect(presetPhase).toBeDefined();
      if (!presetPhase) continue;
      expect(presetPhase.next).toBe(configPhase.next);
    }
  });

  test("phase skip_when arrays match", () => {
    for (const configPhase of config.phases) {
      const presetPhase = ORCHESTRATE_PRESET.phases.find((p) => p.id === configPhase.id);
      expect(presetPhase).toBeDefined();
      if (!presetPhase) continue;
      expect(presetPhase.skip_when ?? []).toEqual(configPhase.skip_when ?? []);
    }
  });

  test("phase actions match", () => {
    for (const configPhase of config.phases) {
      const presetPhase = ORCHESTRATE_PRESET.phases.find((p) => p.id === configPhase.id);
      expect(presetPhase).toBeDefined();
      if (!presetPhase) continue;
      expect(presetPhase.actions ?? []).toEqual(configPhase.actions ?? []);
    }
  });

  test("phase on_advance commands match", () => {
    for (const configPhase of config.phases) {
      const presetPhase = ORCHESTRATE_PRESET.phases.find((p) => p.id === configPhase.id);
      expect(presetPhase).toBeDefined();
      if (!presetPhase) continue;
      const presetCmds = (presetPhase.on_advance ?? []).map((c) => c.command);
      const configCmds = (configPhase.on_advance ?? []).map((c) => c.command);
      expect(presetCmds).toEqual(configCmds);
    }
  });

  test("guard types match", () => {
    const presetTypes = (ORCHESTRATE_PRESET.guards ?? []).map((g) => g.type);
    const configTypes = (config.guards ?? []).map((g) => g.type);
    expect(presetTypes).toEqual(configTypes);
  });

  test("size preset keys match", () => {
    const presetKeys = Object.keys(ORCHESTRATE_PRESET.size_presets ?? {});
    const configKeys = Object.keys(config.size_presets ?? {});
    expect(presetKeys).toEqual(configKeys);
  });

  test("size preset phases arrays match", () => {
    const presetSizes = ORCHESTRATE_PRESET.size_presets ?? {};
    const configSizes = config.size_presets ?? {};
    for (const key of Object.keys(configSizes)) {
      expect(presetSizes[key]).toBeDefined();
      expect(presetSizes[key].phases ?? []).toEqual(configSizes[key].phases ?? []);
    }
  });

  test("size preset skip arrays match", () => {
    const presetSizes = ORCHESTRATE_PRESET.size_presets ?? {};
    const configSizes = config.size_presets ?? {};
    for (const key of Object.keys(configSizes)) {
      expect(presetSizes[key]).toBeDefined();
      expect(presetSizes[key].skip ?? []).toEqual(configSizes[key].skip ?? []);
    }
  });

  test("size preset criteria match", () => {
    const presetSizes = ORCHESTRATE_PRESET.size_presets ?? {};
    const configSizes = config.size_presets ?? {};
    for (const key of Object.keys(configSizes)) {
      expect(presetSizes[key]).toBeDefined();
      expect(presetSizes[key].criteria ?? []).toEqual(configSizes[key].criteria ?? []);
    }
  });

  test("store names match in order", () => {
    const presetNames = ORCHESTRATE_PRESET.ground.stores.map((s) => s.name);
    const configNames = config.ground.stores.map((s) => s.name);
    expect(presetNames).toEqual(configNames);
  });

  test("store kinds match in order", () => {
    const presetKinds = ORCHESTRATE_PRESET.ground.stores.map((s) => s.kind);
    const configKinds = config.ground.stores.map((s) => s.kind);
    expect(presetKinds).toEqual(configKinds);
  });

  test("Memory and Artifact store paths match", () => {
    for (const configStore of config.ground.stores) {
      if (configStore.kind === "Memory" || configStore.kind === "Artifact") {
        const presetStore = ORCHESTRATE_PRESET.ground.stores.find(
          (s) => s.name === configStore.name,
        );
        expect(presetStore).toBeDefined();
        if (!presetStore) continue;
        if (presetStore.kind === "Memory" || presetStore.kind === "Artifact") {
          expect((presetStore as { path: string }).path).toBe(configStore.path);
        }
      }
    }
  });

  test("flow definitions match", () => {
    const presetFlows = (ORCHESTRATE_PRESET.ground.flows ?? []).map((f) => ({
      from: f.from,
      to: f.to,
      trigger: f.trigger,
    }));
    const configFlows = (config.ground.flows ?? []).map((f) => ({
      from: f.from,
      to: f.to,
      trigger: f.trigger,
    }));
    expect(presetFlows).toEqual(configFlows);
  });

  test("transition definitions match", () => {
    const presetTransitions = (ORCHESTRATE_PRESET.transitions ?? []).map((t) => ({
      from: t.from,
      to: t.to,
      when: t.when,
    }));
    const configTransitions = (config.transitions ?? []).map((t) => ({
      from: t.from,
      to: t.to,
      when: t.when,
    }));
    expect(presetTransitions).toEqual(configTransitions);
  });

  test("runtime memory scales match", () => {
    expect(ORCHESTRATE_PRESET.runtime.memory.scales).toEqual(config.runtime.memory.scales);
  });

  test("runtime memory states match", () => {
    expect(ORCHESTRATE_PRESET.runtime.memory.states).toEqual(config.runtime.memory.states);
  });

  test("loadPreset service returns same data as direct constant", async () => {
    const serviceResult = await Effect.runPromise(loadPresetFromService());
    expect(serviceResult.phases.length).toBe(ORCHESTRATE_PRESET.phases.length);
    expect(serviceResult.phases.map((p) => p.id)).toEqual(
      ORCHESTRATE_PRESET.phases.map((p) => p.id),
    );
  });
});

describe("Conformance: guard registry covers all config guard types", () => {
  const config = loadConfigFromYaml();
  const registry = makeGuardRegistry();

  test("every config guard type has a registry handler", () => {
    const configGuardTypes = [...new Set((config.guards ?? []).map((g) => g.type))];
    const registryKeys = Object.keys(registry);
    const missing = configGuardTypes.filter((t) => !registryKeys.includes(t));
    expect(missing).toEqual([]);
  });

  test("no orphan handlers in registry without config entry", () => {
    const configGuardTypes = new Set((config.guards ?? []).map((g) => g.type));
    const registryKeys = Object.keys(registry);
    const orphans = registryKeys.filter((k) => !configGuardTypes.has(k));
    expect(orphans).toEqual([]);
  });

  test("guard count: unique config types matches registry size", () => {
    const uniqueConfigTypes = [...new Set((config.guards ?? []).map((g) => g.type))];
    expect(Object.keys(registry).length).toBe(uniqueConfigTypes.length);
  });
});

describe("Conformance: phase constants", () => {
  const config = loadConfigFromYaml();

  test("first phase is 'setup'", () => {
    expect(config.phases[0].id).toBe("setup");
    expect(ORCHESTRATE_PRESET.phases[0].id).toBe("setup");
  });

  test("terminal phase (next === null) is 'completion'", () => {
    const configTerminal = config.phases.find((p) => p.next === null);
    const presetTerminal = ORCHESTRATE_PRESET.phases.find((p) => p.next === null);
    expect(configTerminal).toBeDefined();
    expect(presetTerminal).toBeDefined();
    if (!configTerminal || !presetTerminal) return;
    expect(configTerminal.id).toBe("completion");
    expect(presetTerminal.id).toBe("completion");
  });

  test("INITIAL_PHASE matches config.phases[0].id", () => {
    // TODO: import from phase.constants.ts when it exists
    const INITIAL_PHASE = "setup";
    expect(INITIAL_PHASE).toBe(config.phases[0].id);
  });

  test("TERMINAL_PHASE matches terminal phase in config", () => {
    // TODO: import from phase.constants.ts when it exists
    const TERMINAL_PHASE = "completion";
    const terminal = config.phases.find((p) => p.next === null);
    expect(terminal).toBeDefined();
    if (!terminal) return;
    expect(TERMINAL_PHASE).toBe(terminal.id);
  });
});
