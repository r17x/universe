import { Console, Context, Effect, Layer, Option, Schema } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { MemoryStore, type MemoryStoreContract, scaleOrder } from "./MemoryStore"
import type { MemoryNode } from "./MemoryParser"
import { EventLog } from "./EventLog"

export const HookInputSchema = Schema.Struct({
  tool_name: Schema.optional(Schema.String),
  tool_input: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  session_id: Schema.optional(Schema.String),
  transcript_path: Schema.optional(Schema.String),
  output: Schema.optional(Schema.String),
  transcript: Schema.optional(Schema.String),
  result: Schema.optional(Schema.String),
  agent_id: Schema.optional(Schema.String),
  agent_type: Schema.optional(Schema.String),
  context_window: Schema.optional(Schema.Struct({
    used_percentage: Schema.optional(Schema.NullOr(Schema.Number)),
  })),
})

export type HookInput = typeof HookInputSchema.Type

export interface HookEnv {
  readonly CLAUDE_PROJECT_DIR: string
  readonly CLAUDE_AGENT_NAME?: string
}

export interface GuardConfig {
  readonly type: string
  readonly description?: string | undefined
  readonly enforced_by?: string | undefined
  readonly event?: string | undefined
  readonly matcher?: string | undefined
  readonly command?: string | undefined
  readonly timeout?: number | undefined
  readonly max?: number | undefined
  readonly warn_at?: number | undefined
  readonly rules?: ReadonlyArray<{
    readonly contains: ReadonlyArray<string>
    readonly should: string
  }> | undefined
}

export interface GuardContext {
  readonly input: HookInput
  readonly env: HookEnv
  readonly guard: GuardConfig
}

export type GuardResult =
  | { readonly _tag: "Allow" }
  | { readonly _tag: "Warn"; readonly message: string }
  | { readonly _tag: "Block"; readonly message: string }

export const Allow: GuardResult = { _tag: "Allow" }
export const Warn = (message: string): GuardResult => ({ _tag: "Warn", message })
export const Block = (message: string): GuardResult => ({ _tag: "Block", message })

const BridgeData = Schema.Struct({
  context_window: Schema.optional(Schema.Struct({
    used_percentage: Schema.optional(Schema.NullOr(Schema.Number)),
  })),
  transcript_path: Schema.optional(Schema.String),
  last_seen: Schema.optional(Schema.String),
})

export const matchesTool = (matcher: string | undefined, toolName: string | undefined): boolean => {
  if (matcher === undefined || matcher === "") return true
  if (toolName === undefined) return false
  const patterns = matcher.split("|")
  return patterns.some((p) => toolName.includes(p))
}

const hashString = (s: string): string => {
  const hash = Array.from(s).reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0)
  return Math.abs(hash).toString(36)
}

export interface GuardEvaluatorContract {
  readonly evaluate: (ctx: GuardContext) => Effect.Effect<GuardResult>
  readonly evaluateAll: (
    guards: ReadonlyArray<GuardConfig>,
    event: string,
    name: string | undefined,
    input: HookInput,
    env: HookEnv,
  ) => Effect.Effect<{ readonly results: readonly GuardResult[] }>
}

const makeEvaluator = (
  memoryStore?: MemoryStoreContract,
): Effect.Effect<GuardEvaluatorContract, never, EventLog | FileSystem | Path> =>
  Effect.gen(function* () {
    const path = yield* Path
    const fs = yield* FileSystem
    const eventLog = yield* EventLog

    const resolveSession = (claudeSid: string | undefined): Effect.Effect<string | undefined> =>
      Effect.gen(function* () {
        if (!claudeSid) return undefined
        return yield* eventLog.resolveByKey("claude", claudeSid).pipe(Effect.orElseSucceed(() => undefined))
      })

    const agentFirst = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.sync(() => {
        if (ctx.input.agent_id !== undefined && ctx.input.agent_id !== "") {
          return Allow
        }
        const filePath = ctx.input.tool_input?.["file_path"] ?? ctx.input.tool_input?.["file"] ?? "unknown"
        const isNix = typeof filePath === "string" && filePath.endsWith(".nix")
        const suggestion = isNix
          ? "Route via /gateway-nix worker agent."
          : "Delegate to the appropriate worker agent."
        return Block(`BLOCKED: Coordinator cannot use ${ctx.input.tool_name} directly.\nFile: ${String(filePath)}\n${suggestion}`)
      })

    const outputLocation = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.sync(() => {
        const raw = ctx.input.tool_input?.["file_path"] ?? ctx.input.tool_input?.["file"]
        if (raw === undefined || typeof raw !== "string") return Allow

        const resolved = path.isAbsolute(raw) ? raw : path.join(ctx.env.CLAUDE_PROJECT_DIR, raw)
        const normalized = path.normalize(resolved)

        if (!normalized.startsWith(ctx.env.CLAUDE_PROJECT_DIR)) {
          return Block(`BLOCKED: Write target outside project directory.\nPath: ${normalized}\nProject: ${ctx.env.CLAUDE_PROJECT_DIR}`)
        }

        const relative = path.relative(ctx.env.CLAUDE_PROJECT_DIR, normalized)
        const restricted = ["secrets/secret.yaml", ".sops.yaml"]
        const restrictedPrefixes = [".git/", "result/"]

        for (const r of restricted) {
          if (relative === r) return Block(`BLOCKED: Write to restricted path: ${relative}`)
        }
        for (const prefix of restrictedPrefixes) {
          if (relative.startsWith(prefix)) return Block(`BLOCKED: Write to restricted path: ${relative}`)
        }

        return Allow
      })

    const BLOCKED_NIX_LEGACY = "nix-" + "instantiate"

    const blockNixBuild = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.sync(() => {
        const command = ctx.input.tool_input?.["command"]
        if (command === undefined || typeof command !== "string") return Allow

        if (command.includes(BLOCKED_NIX_LEGACY)) {
          return Block(`BLOCKED: ${BLOCKED_NIX_LEGACY} is forbidden. Use 'nix eval' instead.`)
        }

        if (command.includes("darwin-rebuild switch") && !command.includes("--dry-run")) {
          return Block("BLOCKED: darwin-rebuild switch is forbidden without --dry-run.")
        }

        return Allow
      })

    const compactionGate = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const claudeSid = ctx.input.session_id
        if (!claudeSid) return Allow

        const anakmagangSid = yield* resolveSession(claudeSid)
        if (!anakmagangSid) return Allow

        const bridge = yield* eventLog.readJson(anakmagangSid, "claude", claudeSid, BridgeData).pipe(
          Effect.orElseSucceed(() => undefined),
        )
        if (!bridge) return Allow

        const pct = bridge.context_window?.used_percentage ?? 0

        if (pct > 85) {
          return Block(`BLOCKED: Context usage at ${Math.round(pct)}%. Save work and hand off before spawning new agents.`)
        }
        if (pct > 75) {
          return Warn(`WARNING: Context usage at ${Math.round(pct)}%. Consider wrapping up soon.`)
        }
        return Allow
      })

    const iterationLimit = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const agentName = ctx.env.CLAUDE_AGENT_NAME
        if (!agentName || agentName.trim() === "") {
          return Allow
        }

        const max = ctx.guard.max ?? 200
        const warnAt = ctx.guard.warn_at ?? 40

        const claudeSid = ctx.input.session_id
        const anakmagangSid = yield* resolveSession(claudeSid)
        if (!anakmagangSid) return Allow

        const currentTask = yield* eventLog.currentTask(anakmagangSid).pipe(
          Effect.orElseSucceed(() => undefined),
        )
        if (!currentTask) return Allow

        const taskHash = hashString(currentTask)
        const count = yield* eventLog.iterationCount(anakmagangSid, agentName, taskHash).pipe(
          Effect.orElseSucceed(() => 0),
        )

        yield* eventLog.appendLog(anakmagangSid, {
          type: "iteration",
          agent: agentName,
          task_hash: taskHash,
          ts: new Date().toISOString(),
        }).pipe(Effect.orElseSucceed(() => void 0))

        const next = count + 1

        if (next >= max) {
          return Block(`BLOCKED: Iteration limit reached for ${agentName} (${next}/${max}). Escalate to user.`)
        }
        if (next >= warnAt) {
          return Warn(`WARNING: ${agentName} at ${next}/${max} tool calls used.`)
        }
        return Allow
      })

    const autoNixEval = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const filePath = ctx.input.tool_input?.["file_path"] ?? ctx.input.tool_input?.["file"]
        if (filePath === undefined || typeof filePath !== "string") return Allow
        if (!filePath.endsWith(".nix")) return Allow

        const proc = Bun.spawn(["nix", "flake", "check", "--no-build"], {
          cwd: ctx.env.CLAUDE_PROJECT_DIR,
          stdout: "pipe",
          stderr: "pipe",
        })
        const exitCode = yield* Effect.promise(() => proc.exited)
        if (exitCode !== 0) {
          const stderr = yield* Effect.promise(() => new Response(proc.stderr).text())
          return Warn(`WARNING: nix flake check failed after editing ${filePath}:\n${stderr.slice(0, 500)}`)
        }
        return Allow
      })

    const injectReminders = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const claudeSid = ctx.input.session_id
        const anakmagangSid = yield* resolveSession(claudeSid)

        const active = anakmagangSid
          ? yield* eventLog.isActive(anakmagangSid).pipe(Effect.orElseSucceed(() => false))
          : false

        if (!active) {
          return Warn(
            "\u26a0\ufe0f MANDATORY: Run /orchestrate before starting any task. No active orchestration session found. Do NOT explore, plan, or delegate until /orchestrate has been run.",
          )
        }

        const parts: string[] = []

        const task = yield* eventLog.currentTask(anakmagangSid!).pipe(Effect.orElseSucceed(() => undefined))
        const phase = yield* eventLog.currentPhase(anakmagangSid!).pipe(
          Effect.orElseSucceed(() => undefined),
        )

        if (task !== undefined) parts.push(`Task: ${task}`)
        if (phase !== undefined) parts.push(`Phase: ${phase}`)

        if (memoryStore && task !== undefined) {
          const stopWords = new Set(["the", "and", "for", "with", "from", "into", "that", "this", "will", "can", "not", "but", "has", "have", "was", "are", "been", "none"])
          const keywords = task.split(/\s+/)
            .map(w => w.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            .filter(w => w.length > 2 && !stopWords.has(w))

          if (keywords.length > 0) {
            const memories = yield* memoryStore.query(keywords, { state: "ACTIVE" }).pipe(
              Effect.orElseSucceed((): readonly MemoryNode[] => [])
            )
            const minIdx = scaleOrder.indexOf("learning")
            const relevant = memories.filter(m => scaleOrder.indexOf(m.scale) >= minIdx)
            for (const m of relevant.slice(0, 5)) {
              parts.push(`Memory[${m.scale}]: ${m.name} — ${m.description}`)
            }
          }
        }

        parts.push("Route Nix work via /gateway-nix. Use /orchestrate for non-trivial tasks.")

        return Warn(parts.join("\n"))
      })

    const agentStopGuard = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.sync(() => {
        const output = ctx.input.output ?? ctx.input.transcript ?? ctx.input.result ?? ""
        const mentionsNix = /\.nix\b/.test(output)
        if (!mentionsNix) return Allow

        const hasVerification = [
          "nix eval",
          "nix flake check",
          "nix flake show",
          "nix fmt",
          "nixfmt",
        ].some((cmd) => output.includes(cmd))

        if (!hasVerification) {
          return Block("BLOCKED: Worker modified .nix files but did not run nix verification.\nRun 'nix flake check --no-build' or 'nix eval' before stopping.")
        }
        return Allow
      })

    const sessionStopGuard = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const claudeSid = ctx.input.session_id
        const anakmagangSid = yield* resolveSession(claudeSid)
        if (!anakmagangSid) return Allow

        const active = yield* eventLog.isActive(anakmagangSid).pipe(
          Effect.orElseSucceed(() => false),
        )
        if (!active) return Allow

        const task = yield* eventLog.currentTask(anakmagangSid).pipe(
          Effect.orElseSucceed(() => undefined),
        )
        const phase = yield* eventLog.currentPhase(anakmagangSid).pipe(
          Effect.orElseSucceed(() => undefined),
        )

        return Block(`BLOCKED: Cannot end session with incomplete task.\nTask: ${task ?? "unknown"}\nPhase: ${phase ?? "unknown"}\nComplete or explicitly abandon the task first.`)
      })

    const contextCache = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const parts: string[] = []

        const pct = Math.round(ctx.input.context_window?.used_percentage ?? 0)
        parts.push(`(${pct}%)`)

        const claudeSid = ctx.input.session_id
        const anakmagangSid = claudeSid
          ? yield* eventLog.resolveByKey("claude", claudeSid).pipe(Effect.orElseSucceed(() => undefined))
          : undefined

        if (anakmagangSid && claudeSid) {
          const currentTask = yield* eventLog.currentTask(anakmagangSid).pipe(
            Effect.orElseSucceed(() => undefined),
          )
          const currentPhase = yield* eventLog.currentPhase(anakmagangSid).pipe(
            Effect.orElseSucceed(() => undefined),
          )

          if (currentTask) {
            const taskDisplay = currentTask.length > 30 ? currentTask.slice(0, 27) + "..." : currentTask
            parts.push(taskDisplay)
            if (currentPhase) {
              parts.push(`phase:${currentPhase}`)
            }
          }

          const taskHash = currentTask ? hashString(currentTask) : undefined
          if (taskHash) {
            const sessions = yield* eventLog.listSessions().pipe(Effect.orElseSucceed((): string[] => []))
            if (sessions.includes(anakmagangSid)) {
              // TODO: EventLog doesn't expose per-agent iteration breakdown yet;
              // for now we skip the worker display in statusLine
            }
          }

          yield* eventLog.writeJson(anakmagangSid, "claude", claudeSid, {
            context_window: ctx.input.context_window,
            transcript_path: ctx.input.transcript_path,
            last_seen: new Date().toISOString(),
          }, BridgeData).pipe(Effect.orElseSucceed(() => void 0))
        }

        yield* Console.log(parts.join(" | "))
        return Allow
      })

    const bridgeOnStart = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.gen(function* () {
        const command = ctx.input.tool_input?.["command"]
        if (command === undefined || typeof command !== "string") return Allow
        if (!command.includes("anakmagang start")) return Allow

        const claudeSid = ctx.input.session_id
        if (!claudeSid) return Allow

        const sessions = yield* eventLog.listSessions().pipe(Effect.orElseSucceed((): string[] => []))

        const withMtime: Array<{ sid: string; mtime: number }> = []
        for (const sid of sessions) {
          const active = yield* eventLog.isActive(sid).pipe(Effect.orElseSucceed(() => false))
          if (!active) continue
          const existing = yield* eventLog.readJson(sid, "claude", claudeSid, BridgeData).pipe(Effect.orElseSucceed(() => undefined))
          if (existing) continue
          const dirPath = path.join(ctx.env.CLAUDE_PROJECT_DIR, ".anakmagang", "out", sid)
          const stat = yield* fs.stat(dirPath).pipe(Effect.option)
          const mtime = Option.match(stat, {
            onNone: () => 0,
            onSome: (s) => Option.getOrElse(s.mtime, () => new Date(0)).getTime(),
          })
          withMtime.push({ sid, mtime })
        }

        withMtime.sort((a, b) => b.mtime - a.mtime)

        if (withMtime.length > 0) {
          const newest = withMtime[0]
          yield* eventLog.writeJson(newest.sid, "claude", claudeSid, {
            context_window: ctx.input.context_window,
            last_seen: new Date().toISOString(),
          }, BridgeData).pipe(Effect.orElseSucceed(() => void 0))
        }

        return Allow
      })

    const commandSubstitute = (ctx: GuardContext): Effect.Effect<GuardResult> =>
      Effect.sync(() => {
        const command = ctx.input.tool_input?.["command"]
        if (command === undefined || typeof command !== "string") return Allow
        const rules = ctx.guard.rules ?? []
        for (const rule of rules) {
          for (const pattern of rule.contains) {
            if (command.includes(pattern)) {
              return Block(`BLOCKED: ${pattern} SHOULD: ${rule.should}`)
            }
          }
        }
        return Allow
      })

    const guardImplementations: Record<string, (ctx: GuardContext) => Effect.Effect<GuardResult>> = {
      "agent-first": agentFirst,
      "output-location": outputLocation,
      "block-nix-build": blockNixBuild,
      "compaction-gate": compactionGate,
      "iteration-limit": iterationLimit,
      "auto-nix-eval": autoNixEval,
      "inject-reminders": injectReminders,
      "agent-stop-guard": agentStopGuard,
      "session-stop-guard": sessionStopGuard,
      "context-cache": contextCache,
      "bridge-on-start": bridgeOnStart,
      "command-substitute": commandSubstitute,
    }

    return {
      evaluate: Effect.fn("GuardEvaluator.evaluate")(function* (ctx: GuardContext) {
        const impl = guardImplementations[ctx.guard.type]
        if (impl === undefined) return Allow
        return yield* impl(ctx)
      }),

      evaluateAll: Effect.fn("GuardEvaluator.evaluateAll")(function* (
        guards: ReadonlyArray<GuardConfig>,
        event: string,
        name: string | undefined,
        input: HookInput,
        env: HookEnv,
      ) {
        const matching = guards.filter((g) => {
          if (g.event !== event) return false
          if (name !== undefined && g.type !== name) return false
          if (!matchesTool(g.matcher, input.tool_name)) return false
          return true
        })
        const results: GuardResult[] = []
        for (const guard of matching) {
          const ctx: GuardContext = { input, env, guard }
          const impl = guardImplementations[guard.type]
          const result = impl === undefined ? Allow : yield* impl(ctx)
          results.push(result)
        }

        return { results }
      }),
    }
  })

export class GuardEvaluator extends Context.Service<GuardEvaluator, GuardEvaluatorContract>()("@anakmagang/GuardEvaluator") {
  static readonly layer = Layer.effect(
    GuardEvaluator,
    makeEvaluator(),
  ).pipe(Layer.provide(EventLog.layer))

  static readonly layerWithMemory = Layer.effect(
    GuardEvaluator,
    Effect.gen(function* () {
      const store = yield* MemoryStore
      return yield* makeEvaluator(store)
    }),
  ).pipe(Layer.provide(Layer.mergeAll(EventLog.layer, MemoryStore.layerWithSearch)))
}
