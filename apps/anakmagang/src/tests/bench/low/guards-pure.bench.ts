import { describe, test } from "bun:test";
import { Effect } from "effect";
import type { GuardContext } from "../../../protocol.GuardResult";
import { agentFirst } from "../../../guard.agent-first";
import { agentStopGuard } from "../../../guard.agent-stop";
import { commandSubstitute } from "../../../guard.command-substitute";
import { reflectionRequired } from "../../../guard.reflection-required";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const run = <A>(effect: Effect.Effect<A, never, unknown>): A =>
  Effect.runSync(effect as Effect.Effect<A, never, never>);

const baseEnv = { CLAUDE_PROJECT_DIR: "/tmp/test" } as const;

const baseGuard = { type: "test" } as const;

const mkCtx = (overrides: Partial<GuardContext>): GuardContext => ({
  input: {},
  env: baseEnv,
  guard: baseGuard,
  ...overrides,
});

const agentFirstCtxBlocked: GuardContext = mkCtx({
  input: { tool_name: "Edit", tool_input: { file_path: "/src/foo.ts" } },
  guard: { type: "agent-first", routes: { ".ts": "effect-ts", ".nix": "nix-coder" } },
});

const agentFirstCtxAllowed: GuardContext = mkCtx({
  input: { tool_name: "Edit", tool_input: { file_path: "/src/foo.ts" }, agent_id: "worker-1" },
  guard: { type: "agent-first", routes: { ".ts": "effect-ts" } },
});

describe("agentFirst", () => {
  test("blocked — no agent_id", () => {
    measure("blocked — no agent_id", () => {
      run(agentFirst(agentFirstCtxBlocked));
    });
  });

  test("allowed — agent_id present", () => {
    measure("allowed — agent_id present", () => {
      run(agentFirst(agentFirstCtxAllowed));
    });
  });
});

const agentStopCtxWithPromise: GuardContext = mkCtx({
  input: { output: "All done.\n\nIMPLEMENTATION_COMPLETE" },
  guard: {
    type: "agent-stop",
    promises: [
      "IMPLEMENTATION_COMPLETE",
      "VERIFICATION_PASSED",
      "VERIFICATION_FAILED",
      "IMPLEMENTATION_BLOCKED",
      "NEEDS_COORDINATOR_INPUT",
    ],
  },
});

const agentStopCtxWithoutPromise: GuardContext = mkCtx({
  input: { output: "I finished the task successfully." },
  guard: {
    type: "agent-stop",
    promises: [
      "IMPLEMENTATION_COMPLETE",
      "VERIFICATION_PASSED",
      "VERIFICATION_FAILED",
      "IMPLEMENTATION_BLOCKED",
      "NEEDS_COORDINATOR_INPUT",
    ],
  },
});

describe("agentStopGuard", () => {
  test("allowed — output contains IMPLEMENTATION_COMPLETE", () => {
    measure("allowed — output contains IMPLEMENTATION_COMPLETE", () => {
      run(agentStopGuard(agentStopCtxWithPromise));
    });
  });

  test("warn — output missing promise", () => {
    measure("warn — output missing promise", () => {
      run(agentStopGuard(agentStopCtxWithoutPromise));
    });
  });
});

const commandSubstituteCtxBlocked: GuardContext = mkCtx({
  input: { tool_name: "Bash", tool_input: { command: "nix build .#anakmagang" } },
  guard: {
    type: "command-substitute",
    rules: [{ contains: ["nix build"], should: "use nix eval or nix flake check --no-build" }],
  },
});

const commandSubstituteCtxAllowed: GuardContext = mkCtx({
  input: { tool_name: "Bash", tool_input: { command: "nix flake check --no-build" } },
  guard: {
    type: "command-substitute",
    rules: [{ contains: ["nix build"], should: "use nix eval or nix flake check --no-build" }],
  },
});

describe("commandSubstitute", () => {
  test("blocked — command matches rule", () => {
    measure("blocked — command matches rule", () => {
      run(commandSubstitute(commandSubstituteCtxBlocked));
    });
  });

  test("allowed — command does not match", () => {
    measure("allowed — command does not match", () => {
      run(commandSubstitute(commandSubstituteCtxAllowed));
    });
  });
});

const reflectionCtxValid: GuardContext = mkCtx({
  input: {
    tool_name: "Bash",
    tool_input: {
      command: `anakmagang eval "I assumed the schema was stable but past feedback showed migration issues"`,
    },
  },
  guard: { type: "reflection-required" },
});

const reflectionCtxFiller: GuardContext = mkCtx({
  input: { tool_name: "Bash", tool_input: { command: `anakmagang eval "done"` } },
  guard: { type: "reflection-required" },
});

const reflectionCtxEmpty: GuardContext = mkCtx({
  input: { tool_name: "Bash", tool_input: { command: `anakmagang eval ""` } },
  guard: { type: "reflection-required" },
});

describe("reflectionRequired", () => {
  test("allowed — valid reflection", () => {
    measure("allowed — valid reflection", () => {
      run(reflectionRequired(reflectionCtxValid));
    });
  });

  test("blocked — filler word", () => {
    measure("blocked — filler word", () => {
      run(reflectionRequired(reflectionCtxFiller));
    });
  });

  test("blocked — empty reflection", () => {
    measure("blocked — empty reflection", () => {
      run(reflectionRequired(reflectionCtxEmpty));
    });
  });
});
