import { Array as Arr, Result, pipe } from "effect";
import { describe, test } from "bun:test";
import { quoteYaml } from "../../../Yaml";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

// -- Inlined private functions from EventLog.ts (not exported) --

type ManifestEvent =
  | {
      readonly type: "task_start";
      readonly task: string;
      readonly size?: string;
      readonly ts: string;
    }
  | {
      readonly type: "phase_advance";
      readonly phase: string;
      readonly reflection: string;
      readonly ts: string;
    }
  | { readonly type: "observation"; readonly text: string; readonly ts: string }
  | {
      readonly type: "dirty_bits";
      readonly phase: string;
      readonly files: ReadonlyArray<string>;
      readonly ts: string;
    };

type LogEvent = {
  readonly type: "iteration";
  readonly agent: string;
  readonly task_hash: string;
  readonly ts: string;
};

const serializeManifestEvent = (event: ManifestEvent) => {
  switch (event.type) {
    case "task_start": {
      const lines = [`- type: task_start`, `  task: ${quoteYaml(event.task)}`];
      if (event.size !== undefined) lines.push(`  size: ${event.size}`);
      lines.push(`  ts: "${event.ts}"`);
      return lines.join("\n");
    }
    case "phase_advance":
      return [
        `- type: phase_advance`,
        `  phase: ${event.phase}`,
        `  reflection: ${quoteYaml(event.reflection)}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "observation":
      return [
        `- type: observation`,
        `  text: ${quoteYaml(event.text)}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
    case "dirty_bits":
      return [
        `- type: dirty_bits`,
        `  phase: ${event.phase}`,
        `  files: ${quoteYaml(event.files.join(","))}`,
        `  ts: "${event.ts}"`,
      ].join("\n");
  }
};

const serializeLogEvent = (event: LogEvent) =>
  [
    `- type: iteration`,
    `  agent: ${event.agent}`,
    `  task_hash: ${event.task_hash}`,
    `  ts: "${event.ts}"`,
  ].join("\n");

const unquoteManifestVal = (raw: string) => {
  const v = raw.trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    : v;
};

const parseManifestEntries = (content: string) => {
  if (content.trim() === "") return [];
  const blocks = pipe(
    content.split(/^(?=- type:)/m),
    Arr.filter((b) => b.trim() !== ""),
  );
  return pipe(
    Arr.map(blocks, (block) => {
      const lines = pipe(
        block.split("\n"),
        Arr.filter((l) => l.trim() !== ""),
      );
      const fields: { type: string; [key: string]: string | undefined } = {
        type: "",
        ...Object.fromEntries(
          Arr.filterMap(lines, (line) => {
            const trimmed = line.startsWith("- ") ? line.slice(2).trim() : line.trim();
            const colonIdx = trimmed.indexOf(":");
            return colonIdx === -1
              ? Result.failVoid
              : Result.succeed([
                  trimmed.slice(0, colonIdx).trim(),
                  unquoteManifestVal(trimmed.slice(colonIdx + 1)),
                ] as const);
          }),
        ),
      };
      return fields;
    }),
    Arr.filter((entry) => entry.type !== ""),
  );
};

const unquoteVal = (raw: string) => {
  const v = raw.trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1)
    : v;
};

const parseLogEntries = (content: string) => {
  if (content.trim() === "") return [];
  const blocks = pipe(
    content.split(/^(?=- type:)/m),
    Arr.filter((b) => b.trim() !== ""),
  );
  return Arr.map(blocks, (block) => {
    const lines = pipe(
      block.split("\n"),
      Arr.filter((l) => l.trim() !== ""),
    );
    const fields: Record<string, string> = Object.fromEntries(
      Arr.filterMap(lines, (line) => {
        const trimmed = line.startsWith("- ") ? line.slice(2).trim() : line.trim();
        const colonIdx = trimmed.indexOf(":");
        return colonIdx === -1
          ? Result.failVoid
          : Result.succeed([
              trimmed.slice(0, colonIdx).trim(),
              unquoteVal(trimmed.slice(colonIdx + 1)),
            ] as const);
      }),
    );
    return {
      type: fields["type"] ?? "",
      agent: fields["agent"] ?? "",
      task_hash: fields["task_hash"] ?? "",
      ts: fields["ts"] ?? "",
    };
  });
};

// -- Fixtures --

const ts = "2026-05-22T10:00:00.000Z";

const taskStartEvent: ManifestEvent = {
  type: "task_start",
  task: "implement search service",
  size: "MEDIUM",
  ts,
};
const phaseAdvanceEvent: ManifestEvent = {
  type: "phase_advance",
  phase: "discovery",
  reflection: "I searched broadly across the codebase and found the key patterns.",
  ts,
};
const observationEvent: ManifestEvent = {
  type: "observation",
  text: "approach: tried inline parsing, works well for structured YAML",
  ts,
};
const dirtyBitsEvent: ManifestEvent = {
  type: "dirty_bits",
  phase: "implementation",
  files: ["src/Search.ts", "src/Config.ts", "src/tests/Search.test.ts"],
  ts,
};

const manifestFixture10 = [
  `- type: task_start\n  task: "implement memory subsystem"\n  size: LARGE\n  ts: "${ts}"`,
  `- type: phase_advance\n  phase: setup\n  reflection: "Checked past feedback, no assumptions carried."\n  ts: "${ts}"`,
  `- type: observation\n  text: "finding: Config module already supports outDir"\n  ts: "${ts}"`,
  `- type: phase_advance\n  phase: triage\n  reflection: "Solving the right problem; size is LARGE due to cross-cutting impact."\n  ts: "${ts}"`,
  `- type: dirty_bits\n  phase: discovery\n  files: "src/Memory.ts,src/MemoryStore.ts"\n  ts: "${ts}"`,
  `- type: phase_advance\n  phase: discovery\n  reflection: "Searched 12 files, found 3 relevant patterns."\n  ts: "${ts}"`,
  `- type: observation\n  text: "decision: chose append-only log over mutable JSON"\n  ts: "${ts}"`,
  `- type: phase_advance\n  phase: brainstorming\n  reflection: "Three genuinely different approaches identified."\n  ts: "${ts}"`,
  `- type: observation\n  text: "approach: using Schema.TaggedEnum for memory types"\n  ts: "${ts}"`,
  `- type: phase_advance\n  phase: architecture\n  reflection: "Design handles edge cases; not overengineered."\n  ts: "${ts}"`,
].join("\n");

const logFixture20 = Arr.makeBy(20, (i) =>
  [
    `- type: iteration`,
    `  agent: effect-ts`,
    `  task_hash: abc${String(i).padStart(3, "0")}`,
    `  ts: "${ts}"`,
  ].join("\n"),
).join("\n");

// -- Benchmarks --

describe("Serialization", () => {
  test("serializeManifestEvent — task_start", () => {
    measure("serializeManifestEvent — task_start", () => {
      serializeManifestEvent(taskStartEvent);
    });
  });

  test("serializeManifestEvent — phase_advance", () => {
    measure("serializeManifestEvent — phase_advance", () => {
      serializeManifestEvent(phaseAdvanceEvent);
    });
  });

  test("serializeManifestEvent — observation", () => {
    measure("serializeManifestEvent — observation", () => {
      serializeManifestEvent(observationEvent);
    });
  });

  test("serializeManifestEvent — dirty_bits", () => {
    measure("serializeManifestEvent — dirty_bits", () => {
      serializeManifestEvent(dirtyBitsEvent);
    });
  });

  test("serializeLogEvent — iteration", () => {
    measure("serializeLogEvent — iteration", () => {
      serializeLogEvent({ type: "iteration", agent: "effect-ts", task_hash: "abc123", ts });
    });
  });
});

describe("Parsing", () => {
  test("parseManifestEntries — 10 events", () => {
    measure("parseManifestEntries — 10 events", () => {
      parseManifestEntries(manifestFixture10);
    });
  });

  test("parseLogEntries — 20 iterations", () => {
    measure("parseLogEntries — 20 iterations", () => {
      parseLogEntries(logFixture20);
    });
  });
});
