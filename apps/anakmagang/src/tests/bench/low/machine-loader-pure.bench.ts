import { describe, test } from "bun:test";
import { Schema } from "effect";
import { configToYaml, MachineConfig } from "../../../MachineLoader";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const fullConfig: typeof MachineConfig.Type = {
  name: "bench-machine",
  version: 2,
  ground: {
    stores: [
      {
        kind: "Slot",
        name: "manifest",
        per: "singleton",
        tracks: {
          current_task: "set",
          current_phase: "set",
          completed_phases: "append",
          task_size: "set",
        },
      },
      {
        kind: "Slot",
        name: "feedback",
        per: "session",
        tracks: {
          reflections: "append",
          observations: "append",
        },
      },
      {
        kind: "Memory",
        name: "learnings",
        path: ".claude/memories",
        budget: 8,
      },
      {
        kind: "Artifact",
        name: "sessions",
        path: ".anakmagang/out",
        writable: true,
      },
      {
        kind: "Artifact",
        name: "references",
        path: ".anakmagang/references",
        writable: false,
      },
    ],
    flows: [
      { from: "feedback", to: "learnings", trigger: "phase.completion.actions.extract_memories" },
      { from: "learnings", to: "architecture", trigger: "manual" },
    ],
  },
  runtime: {
    memory: {
      scales: ["observation", "finding", "learning", "principle"],
      states: ["ACTIVE", "STALE", "ARCHIVED"],
      stale_thresholds: { user: 10, feedback: 3, project: 5, reference: 8 },
      promotion: { min_sources: 3, auto: false },
      graph: { edge_types: ["derived_from"], max_depth: 2, max_fan_out: 5, max_query_nodes: 10 },
    },
  },
  phases: [
    {
      id: "setup",
      name: "Setup",
      exit_question: "What assumptions am I carrying?",
      next: "triage",
      actions: ["read_manifest", "read_feedback"],
    },
    {
      id: "triage",
      name: "Triage",
      exit_question: "Am I solving the right problem?",
      next: "discovery",
      skip_when: ["TRIVIAL"],
    },
    {
      id: "discovery",
      name: "Discovery",
      exit_question: "Did I search broadly enough?",
      next: "implementation",
    },
    {
      id: "implementation",
      name: "Implementation",
      exit_question: "Did I delegate with enough context?",
      next: "completion",
      on_advance: [{ command: "pre-commit run --files {dirty-files}" }],
    },
    {
      id: "completion",
      name: "Completion",
      exit_question: "What did this session teach me?",
      next: null,
      actions: ["write_feedback_summary", "extract_memories"],
      on_advance: [{ command: "pre-commit run --files {dirty-files}" }],
    },
  ],
  transitions: [
    {
      from: "*",
      to: "previous",
      when: "confidence_low",
      description: "Low confidence triggers re-evaluation",
    },
  ],
  guards: [
    {
      type: "agent-first",
      description: "Coordinator never edits files directly",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Edit|Write",
      timeout: 5,
    },
    {
      type: "output-location",
      description: "Writes constrained to project directory",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Edit|Write",
      timeout: 5,
    },
    {
      type: "iteration-limit",
      description: "Cap tool calls per task",
      enforced_by: "hook",
      event: "PreToolUse",
      max: 50,
      warn_at: 40,
      timeout: 5,
    },
    {
      type: "reflection-required",
      description: "Exit question must be answered before phase transition",
      enforced_by: "manifest",
    },
  ],
  size_presets: {
    TRIVIAL: {
      phases: ["setup", "implementation", "completion"],
      criteria: ["No behavioral change — typo, comment, formatting"],
    },
    SMALL: {
      skip: ["discovery"],
      criteria: ["Single behavioral change, isolated blast radius"],
    },
    MEDIUM: {
      skip: [],
      criteria: ["Changes contracts, defaults, or observable output"],
    },
    LARGE: {
      phases: ["all"],
      criteria: ["New subsystem or cross-platform changes"],
    },
  },
};

const validConfigPlain = {
  name: "decode-test",
  version: 1,
  ground: {
    stores: [{ kind: "Slot", name: "state", per: "singleton", tracks: { phase: "set" } }],
  },
  runtime: {
    memory: {
      scales: ["observation", "learning"],
      states: ["ACTIVE"],
      stale_thresholds: { project: 5 },
      promotion: { min_sources: 2, auto: false },
      graph: { edge_types: ["derived_from"], max_depth: 3, max_fan_out: 4, max_query_nodes: 8 },
    },
  },
  phases: [
    { id: "setup", name: "Setup", exit_question: "Ready?", next: "done" },
    { id: "done", name: "Done", exit_question: "Complete?", next: null },
  ],
  transitions: [{ from: "*", to: "previous", when: "confidence_low" }],
  guards: [
    { type: "agent-first", enforced_by: "hook", event: "PreToolUse", matcher: "Edit", timeout: 5 },
  ],
  size_presets: { SMALL: { skip: [], criteria: ["Minor change"] } },
};

const decodeSync = Schema.decodeUnknownSync(MachineConfig);

describe("configToYaml", () => {
  test("full MachineConfig to YAML value", () => {
    measure("full MachineConfig to YAML value", () => {
      configToYaml(fullConfig);
    });
  });
});

describe("Schema Decode", () => {
  test("Schema.decodeUnknownSync(MachineConfig) — valid config", () => {
    measure("Schema.decodeUnknownSync(MachineConfig) — valid config", () => {
      decodeSync(validConfigPlain);
    });
  });
});
