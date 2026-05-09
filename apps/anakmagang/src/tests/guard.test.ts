import { describe, test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { BunServices } from "@effect/platform-bun"
import { GuardEvaluator, matchesTool, type GuardConfig, type HookInput, type HookEnv } from "../guard"

describe("matchesTool", () => {
  test("undefined matcher matches everything", () => {
    expect(matchesTool(undefined, "Edit")).toBe(true)
  })

  test("empty matcher matches everything", () => {
    expect(matchesTool("", "Edit")).toBe(true)
  })

  test("pipe-separated patterns match substring", () => {
    expect(matchesTool("Edit|Write", "Edit")).toBe(true)
    expect(matchesTool("Edit|Write", "Write")).toBe(true)
    expect(matchesTool("Edit|Write", "Bash")).toBe(false)
  })

  test("undefined tool name doesn't match", () => {
    expect(matchesTool("Edit", undefined)).toBe(false)
  })
})

describe("GuardEvaluator", () => {
  const TestLayer = GuardEvaluator.layer.pipe(Layer.provideMerge(BunServices.layer))

  const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(TestLayer)
      )
    )

  const env: HookEnv = {
    CLAUDE_PROJECT_DIR: "/tmp/test-project",
  }

  test("agent-first blocks when no agent_id", async () => {
    const guard: GuardConfig = { type: "agent-first", event: "PreToolUse", matcher: "Edit|Write" }
    const input: HookInput = { tool_name: "Edit", tool_input: { file_path: "/tmp/test.ts" } }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Block")
  })

  test("agent-first allows when agent_id set", async () => {
    const guard: GuardConfig = { type: "agent-first", event: "PreToolUse", matcher: "Edit|Write" }
    const input: HookInput = { tool_name: "Edit", tool_input: { file_path: "/tmp/test.ts" }, agent_id: "effect-ts" }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Allow")
  })

  test("block-nix-build blocks nix-instantiate", async () => {
    const guard: GuardConfig = { type: "block-nix-build", event: "PreToolUse", matcher: "Bash" }
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "nix-instantiate ./default.nix" } }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Block")
  })

  test("evaluateAll filters by event and matcher", async () => {
    const guards: GuardConfig[] = [
      { type: "agent-first", event: "PreToolUse", matcher: "Edit|Write" },
      { type: "block-nix-build", event: "PreToolUse", matcher: "Bash" },
    ]
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "echo hello" } }
    const results = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluateAll(guards, "PreToolUse", undefined, input, env)
      })
    )
    expect(results.results.length).toBe(1)
    expect(results.results[0]._tag).toBe("Allow")
  })

  test("command-substitute blocks npm and suggests bun", async () => {
    const guard: GuardConfig = {
      type: "command-substitute",
      event: "PreToolUse",
      matcher: "Bash",
      rules: [
        { contains: ["npm", "pnpm", "yarn"], should: "bun" },
      ],
    }
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "npm install react" } }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Block")
    expect((result as any).message).toContain("npm")
    expect((result as any).message).toContain("bun")
  })

  test("command-substitute blocks npx and suggests bunx", async () => {
    const guard: GuardConfig = {
      type: "command-substitute",
      event: "PreToolUse",
      matcher: "Bash",
      rules: [
        { contains: ["npx", "pnpx"], should: "bunx" },
      ],
    }
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "npx create-react-app" } }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Block")
    expect((result as any).message).toContain("npx")
    expect((result as any).message).toContain("bunx")
  })

  test("command-substitute allows bun commands", async () => {
    const guard: GuardConfig = {
      type: "command-substitute",
      event: "PreToolUse",
      matcher: "Bash",
      rules: [
        { contains: ["npm", "pnpm", "yarn"], should: "bun" },
      ],
    }
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "bun install react" } }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Allow")
  })

  test("command-substitute with no rules allows everything", async () => {
    const guard: GuardConfig = {
      type: "command-substitute",
      event: "PreToolUse",
      matcher: "Bash",
    }
    const input: HookInput = { tool_name: "Bash", tool_input: { command: "npm install" } }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Allow")
  })

  test("unknown guard type returns Allow", async () => {
    const guard: GuardConfig = { type: "nonexistent-guard", event: "PreToolUse" }
    const input: HookInput = { tool_name: "Read" }
    const result = await run(
      Effect.gen(function* () {
        const evaluator = yield* GuardEvaluator
        return yield* evaluator.evaluate({ input, env, guard })
      })
    )
    expect(result._tag).toBe("Allow")
  })
})
