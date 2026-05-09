import { Flag, Command } from "effect/unstable/cli"
import { Console, Effect, Schema } from "effect"
import { MachineLoader } from "./MachineLoader"
import { Config } from "./Config"
import { HookLayers } from "./hook"
import { GuardEvaluator, HookInputSchema, type HookInput, type HookEnv } from "./guard"

const readStdin = Effect.callback<string, never>((resume) => {
  const chunks: string[] = []
  process.stdin.setEncoding("utf-8")
  process.stdin.on("data", (chunk: string) => chunks.push(chunk))
  process.stdin.on("end", () => resume(Effect.succeed(chunks.join(""))))
  process.stdin.on("error", () => resume(Effect.succeed("")))
  if (process.stdin.isTTY) resume(Effect.succeed(""))
})

export const hookEvalCommand = Command.make(
  "eval",
  {
    event: Flag.string("event").pipe(Flag.withAlias("e")),
    name: Flag.string("name").pipe(Flag.withAlias("n"), Flag.optional),
  },
  ({ event, name }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const loader = yield* MachineLoader
      const guardEvaluator = yield* GuardEvaluator
      const machine = yield* loader.loadFromFile(config.configPath)
      const guards = machine.guards ?? []

      const stdinText = yield* readStdin
      const input: HookInput = stdinText.trim().length > 0
        ? yield* Schema.decodeUnknownEffect(HookInputSchema)(
            yield* Effect.sync(() => { try { return JSON.parse(stdinText) } catch { return {} } }),
          ).pipe(Effect.orElseSucceed((): HookInput => ({})))
        : {}

      const agentName = process.env["CLAUDE_AGENT_NAME"]
      const env: HookEnv = {
        CLAUDE_PROJECT_DIR: process.env["CLAUDE_PROJECT_DIR"] ?? config.root,
        ...(agentName ? { CLAUDE_AGENT_NAME: agentName } : {}),
      }

      const nameValue = name._tag === "Some" ? name.value : undefined
      const { results } = yield* guardEvaluator.evaluateAll(guards, event, nameValue, input, env)

      for (const result of results) {
        if (result._tag === "Block") {
          yield* Console.error(result.message)
          return yield* Effect.sync(() => process.exit(2))
        }
        if (result._tag === "Warn") {
          yield* (event === "UserPromptSubmit" ? Console.log : Console.error)(result.message)
        }
      }
    }).pipe(Effect.provide(HookLayers)),
)
