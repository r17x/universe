import { Context, Data, Effect, Layer, Schema } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import * as Yaml from "./Yaml"

const PhaseConfig = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  exit_question: Schema.String,
  next: Schema.NullOr(Schema.String),
  actions: Schema.optional(Schema.Array(Schema.String)),
  skip_when: Schema.optional(Schema.Array(Schema.String)),
})

const GuardConfig = Schema.Struct({
  type: Schema.String,
  description: Schema.optional(Schema.String),
  enforced_by: Schema.optional(Schema.String),
  event: Schema.optional(Schema.String),
  matcher: Schema.optional(Schema.String),
  command: Schema.optional(Schema.String),
  timeout: Schema.optional(Schema.Number),
  max: Schema.optional(Schema.Number),
  warn_at: Schema.optional(Schema.Number),
})

const TransitionConfig = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  when: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
})

const SizePresetConfig = Schema.Struct({
  phases: Schema.optional(Schema.Array(Schema.String)),
  skip: Schema.optional(Schema.Array(Schema.String)),
})

const GranularityConfig = Schema.Literals(["singleton", "session", "phase", "task"])

const FieldMode = Schema.Literals(["set", "append", "merge", "incr"])
const SchemaType = Schema.Literals(["manifest", "feedback", "file_list", "counter", "freeform"])

const StateSlotConfig = Schema.Struct({
  schema: SchemaType,
  tracks: Schema.Record(Schema.String, FieldMode),
  per: GranularityConfig,
})

const StateConfig = Schema.Record(Schema.String, StateSlotConfig)

const PromotionConfig = Schema.Struct({
  min_sources: Schema.Number,
  auto: Schema.Boolean,
})

const GraphConfig = Schema.Struct({
  edge_types: Schema.Array(Schema.String),
  max_depth: Schema.Number,
  max_fan_out: Schema.Number,
  max_query_nodes: Schema.Number,
})

const MemoryDirConfig = Schema.Struct({
  path: Schema.String,
  source: Schema.String,
})

const MemoryConfig = Schema.Struct({
  dirs: Schema.Array(MemoryDirConfig).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([{ path: ".claude/memories", source: "permanent" }]))
  ),
  scales: Schema.Array(Schema.String),
  states: Schema.Array(Schema.String),
  stale_thresholds: Schema.Record(Schema.String, Schema.Number),
  promotion: PromotionConfig,
  graph: GraphConfig,
  budget: Schema.Number,
})

export const MachineConfig = Schema.Struct({
  name: Schema.String,
  version: Schema.Number,
  state: StateConfig,
  memory: MemoryConfig,
  phases: Schema.Array(PhaseConfig),
  transitions: Schema.optional(Schema.Array(TransitionConfig)),
  guards: Schema.optional(Schema.Array(GuardConfig)),
  size_presets: Schema.optional(Schema.Record(Schema.String, SizePresetConfig)),
})

const R17X_ORCHESTRATE: typeof MachineConfig.Type = {
  name: "r17x-orchestrate",
  version: 1,
  state: {
    manifest: {
      schema: "manifest",
      tracks: {
        current_task: "set",
        current_phase: "set",
        completed_phases: "append",
        task_size: "set",
      },
      per: "singleton",
    },
    feedback: {
      schema: "feedback",
      tracks: {
        reflections: "append",
        observations: "append",
      },
      per: "session",
    },
  },
  memory: {
    dirs: [
      { path: ".claude/memories", source: "permanent" },
      { path: ".anakmagang/out/references", source: "ephemeral" },
    ],
    scales: ["observation", "finding", "learning", "principle"],
    states: ["ACTIVE", "STALE", "ARCHIVED"],
    stale_thresholds: { user: 10, feedback: 3, project: 5, reference: 8 },
    promotion: { min_sources: 3, auto: false },
    graph: { edge_types: ["derived_from"], max_depth: 2, max_fan_out: 5, max_query_nodes: 10 },
    budget: 8,
  },
  phases: [
    {
      id: "setup",
      name: "Setup",
      exit_question:
        "What assumptions am I carrying? What did past feedback tell me?",
      next: "triage",
      actions: ["read_manifest", "read_feedback", "read_architecture"],
    },
    {
      id: "triage",
      name: "Triage",
      exit_question:
        "Am I solving the right problem? Is my size classification honest or wishful?",
      next: "discovery",
      skip_when: ["TRIVIAL"],
    },
    {
      id: "discovery",
      name: "Discovery",
      exit_question:
        "Am I anchoring on the first thing I found, or did I search broadly enough?",
      next: "skill_discovery",
    },
    {
      id: "skill_discovery",
      name: "Skill Discovery",
      exit_question:
        "Do I have the right tools, or am I forcing familiar ones onto this problem?",
      next: "complexity",
    },
    {
      id: "complexity",
      name: "Complexity Analysis",
      exit_question:
        "What am I underestimating? What unknown could derail this?",
      next: "brainstorming",
      skip_when: ["TRIVIAL", "SMALL", "MEDIUM"],
    },
    {
      id: "brainstorming",
      name: "Brainstorming",
      exit_question:
        "Are these genuinely different approaches, or variations of the same idea?",
      next: "architecture",
      skip_when: ["TRIVIAL", "SMALL"],
    },
    {
      id: "architecture",
      name: "Architecture",
      exit_question:
        "Will this design survive edge cases I haven't imagined? Am I overengineering?",
      next: "implementation",
      skip_when: ["TRIVIAL", "SMALL"],
    },
    {
      id: "implementation",
      name: "Implementation",
      exit_question:
        "Did I delegate with enough context? Could the worker misinterpret my intent?",
      next: "design_verification",
    },
    {
      id: "design_verification",
      name: "Design Verification",
      exit_question:
        "Did the implementation drift from the design? Why?",
      next: "domain_compliance",
      skip_when: ["TRIVIAL", "SMALL"],
    },
    {
      id: "domain_compliance",
      name: "Domain Compliance",
      exit_question:
        "Am I checking rules mechanically, or understanding their intent?",
      next: "code_quality",
    },
    {
      id: "code_quality",
      name: "Code Quality",
      exit_question:
        "Would I be confident rebuilding the system right now? What makes me hesitate?",
      next: "test_planning",
      skip_when: ["TRIVIAL", "SMALL"],
    },
    {
      id: "test_planning",
      name: "Test Planning",
      exit_question:
        "Am I testing what matters, or what's easy to test?",
      next: "testing",
    },
    {
      id: "testing",
      name: "Testing",
      exit_question:
        "Do these checks prove correctness, or just exercise code paths?",
      next: "coverage",
    },
    {
      id: "coverage",
      name: "Coverage Analysis",
      exit_question:
        "What failure mode isn't covered? What would a real user do that I haven't tested?",
      next: "test_quality",
    },
    {
      id: "test_quality",
      name: "Test Quality",
      exit_question:
        "Could these checks pass with subtly broken code? Are the assertions meaningful?",
      next: "completion",
    },
    {
      id: "completion",
      name: "Completion",
      exit_question:
        "What would I do differently if I started over? What did this session teach me?",
      next: null,
      actions: [
        "write_feedback_summary",
        "extract_memories",
        "update_manifest",
      ],
    },
  ],
  transitions: [
    {
      from: "*",
      to: "previous",
      when: "confidence_low",
      description: "Low confidence reflection triggers re-evaluation",
    },
  ],
  guards: [
    {
      type: "agent-first",
      description: "Coordinator never edits files directly",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Edit|Write",
      command: ".claude/hooks/agent-first-enforcement.sh",
      timeout: 5,
    },
    {
      type: "output-location",
      description: "Writes constrained to project directory",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Edit|Write",
      command: ".claude/hooks/output-location-enforcement.sh",
      timeout: 5,
    },
    {
      type: "block-nix-build",
      description: "Block slow nix" + "-build and nix" + "-instantiate commands",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Bash",
      command: ".claude/hooks/block-nix-build.sh",
      timeout: 5,
    },
    {
      type: "compaction-gate",
      description: "Block agent spawning at high context usage",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Agent",
      command: ".claude/hooks/compaction-gate.sh",
      timeout: 5,
    },
    {
      type: "iteration-limit",
      description: "Cap tool calls per task",
      enforced_by: "hook",
      event: "PreToolUse",
      max: 50,
      warn_at: 40,
      command: ".claude/hooks/iteration-limit.sh",
      timeout: 5,
    },
    {
      type: "auto-nix-eval",
      description: "Auto-verify nix files after edit",
      enforced_by: "hook",
      event: "PostToolUse",
      matcher: "Edit|Write",
      command: ".claude/hooks/auto-nix-eval.sh",
      timeout: 30,
    },
    {
      type: "inject-reminders",
      description: "Inject phase reminders on user prompt",
      enforced_by: "hook",
      event: "UserPromptSubmit",
      command: ".claude/hooks/inject-reminders.sh",
      timeout: 5,
    },
    {
      type: "agent-stop-guard",
      description: "Ensure worker verified nix changes before stop",
      enforced_by: "hook",
      event: "SubagentStop",
      command: ".claude/hooks/agent-stop-guard.sh",
      timeout: 5,
    },
    {
      type: "session-stop-guard",
      description: "Prevent session end with incomplete task",
      enforced_by: "hook",
      event: "Stop",
      command: ".claude/hooks/session-stop-guard.sh",
      timeout: 5,
    },
    {
      type: "context-cache",
      description: "Cache context window usage for other hooks",
      enforced_by: "statusLine",
      event: "statusLine",
      command: ".claude/hooks/cache-context-state.sh",
    },
    {
      type: "reflection-required",
      description: "Exit question must be answered before phase transition",
      enforced_by: "manifest",
    },
  ],
  size_presets: {
    TRIVIAL: { phases: ["setup", "implementation", "completion"] },
    SMALL: {
      skip: [
        "complexity",
        "brainstorming",
        "architecture",
        "design_verification",
        "code_quality",
      ],
    },
    MEDIUM: { skip: ["complexity"] },
    LARGE: { phases: ["all"] },
  },
}

const BUNDLED_PRESETS: Record<string, typeof MachineConfig.Type> = {
  "r17x-orchestrate": R17X_ORCHESTRATE,
}

export class MachineLoadError extends Data.TaggedError("MachineLoadError")<{
  readonly source: string
  readonly message: string
}> {}

export interface GeneratedFile {
  readonly path: string
  readonly status: "created" | "skipped" | "updated"
}

const stateSlotToYaml = (slot: typeof StateSlotConfig.Type): Yaml.YamlValue =>
  Yaml.map([
    { key: "schema", value: Yaml.scalar(slot.schema) },
    { key: "tracks", value: Yaml.map(
      Object.entries(slot.tracks).map(([k, v]) => ({ key: k, value: Yaml.scalar(v) }))
    ) },
    { key: "per", value: Yaml.scalar(slot.per) },
  ])

const configToYaml = (config: typeof MachineConfig.Type): Yaml.YamlValue => {
  const entries: Array<{ key: string; value: Yaml.YamlValue }> = []

  entries.push({ key: "name", value: Yaml.scalar(config.name) })
  entries.push({ key: "version", value: Yaml.scalar(config.version) })

  entries.push({
    key: "state",
    value: Yaml.map(
      Object.entries(config.state).map(([key, slot]) => ({
        key,
        value: stateSlotToYaml(slot),
      }))
    ),
  })

  entries.push({
    key: "memory",
    value: Yaml.map([
      { key: "dirs", value: Yaml.list(
        config.memory.dirs.map(d => Yaml.map([
          { key: "path", value: Yaml.scalar(d.path) },
          { key: "source", value: Yaml.scalar(d.source) },
        ]))
      ) },
      { key: "scales", value: Yaml.list(config.memory.scales.map(Yaml.scalar)) },
      { key: "states", value: Yaml.list(config.memory.states.map(Yaml.scalar)) },
      {
        key: "stale_thresholds",
        value: Yaml.map(
          Object.entries(config.memory.stale_thresholds).map(([k, v]) => ({
            key: k,
            value: Yaml.scalar(v),
          })),
        ),
      },
      {
        key: "promotion",
        value: Yaml.map([
          { key: "min_sources", value: Yaml.scalar(config.memory.promotion.min_sources) },
          { key: "auto", value: Yaml.scalar(config.memory.promotion.auto) },
        ]),
      },
      {
        key: "graph",
        value: Yaml.map([
          { key: "edge_types", value: Yaml.list(config.memory.graph.edge_types.map(Yaml.scalar)) },
          { key: "max_depth", value: Yaml.scalar(config.memory.graph.max_depth) },
          { key: "max_fan_out", value: Yaml.scalar(config.memory.graph.max_fan_out) },
          { key: "max_query_nodes", value: Yaml.scalar(config.memory.graph.max_query_nodes) },
        ]),
      },
      { key: "budget", value: Yaml.scalar(config.memory.budget) },
    ]),
  })

  entries.push({
    key: "phases",
    value: Yaml.list(
      config.phases.map((phase) => {
        const phaseEntries: Array<{ key: string; value: Yaml.YamlValue }> = [
          { key: "id", value: Yaml.scalar(phase.id) },
          { key: "name", value: Yaml.scalar(phase.name) },
          { key: "exit_question", value: Yaml.scalar(phase.exit_question) },
          { key: "next", value: Yaml.scalar(phase.next) },
        ]
        if (phase.actions !== undefined && phase.actions.length > 0) {
          phaseEntries.push({
            key: "actions",
            value: Yaml.list(phase.actions.map(Yaml.scalar)),
          })
        }
        if (phase.skip_when !== undefined && phase.skip_when.length > 0) {
          phaseEntries.push({
            key: "skip_when",
            value: Yaml.list(phase.skip_when.map(Yaml.scalar)),
          })
        }
        return Yaml.map(phaseEntries)
      }),
    ),
  })

  if (config.transitions !== undefined && config.transitions.length > 0) {
    entries.push({
      key: "transitions",
      value: Yaml.list(
        config.transitions.map((t) => {
          const tEntries: Array<{ key: string; value: Yaml.YamlValue }> = [
            { key: "from", value: Yaml.scalar(t.from) },
            { key: "to", value: Yaml.scalar(t.to) },
          ]
          if (t.when !== undefined) tEntries.push({ key: "when", value: Yaml.scalar(t.when) })
          if (t.description !== undefined) tEntries.push({ key: "description", value: Yaml.scalar(t.description) })
          return Yaml.map(tEntries)
        }),
      ),
    })
  }

  if (config.guards !== undefined && config.guards.length > 0) {
    entries.push({
      key: "guards",
      value: Yaml.list(
        config.guards.map((g) => {
          const gEntries: Array<{ key: string; value: Yaml.YamlValue }> = [
            { key: "type", value: Yaml.scalar(g.type) },
          ]
          if (g.description !== undefined) gEntries.push({ key: "description", value: Yaml.scalar(g.description) })
          if (g.enforced_by !== undefined) gEntries.push({ key: "enforced_by", value: Yaml.scalar(g.enforced_by) })
          if (g.event !== undefined) gEntries.push({ key: "event", value: Yaml.scalar(g.event) })
          if (g.matcher !== undefined) gEntries.push({ key: "matcher", value: Yaml.scalar(g.matcher) })
          if (g.command !== undefined) gEntries.push({ key: "command", value: Yaml.scalar(g.command) })
          if (g.timeout !== undefined) gEntries.push({ key: "timeout", value: Yaml.scalar(g.timeout) })
          if (g.max !== undefined) gEntries.push({ key: "max", value: Yaml.scalar(g.max) })
          if (g.warn_at !== undefined) gEntries.push({ key: "warn_at", value: Yaml.scalar(g.warn_at) })
          return Yaml.map(gEntries)
        }),
      ),
    })
  }

  if (config.size_presets !== undefined) {
    entries.push({
      key: "size_presets",
      value: Yaml.map(
        Object.entries(config.size_presets).map(([key, presetRaw]) => {
          const preset = presetRaw
          const pEntries: Array<{ key: string; value: Yaml.YamlValue }> = []
          if (preset.phases !== undefined && preset.phases.length > 0) {
            pEntries.push({ key: "phases", value: Yaml.list(preset.phases.map(Yaml.scalar)) })
          }
          if (preset.skip !== undefined && preset.skip.length > 0) {
            pEntries.push({ key: "skip", value: Yaml.list(preset.skip.map(Yaml.scalar)) })
          }
          return { key, value: Yaml.map(pEntries) }
        }),
      ),
    })
  }

  return Yaml.map(entries)
}

const generatePhaseTable = (
  config: typeof MachineConfig.Type,
): string => {
  const lines: string[] = []

  lines.push("## Orchestration Phases")
  lines.push("")
  lines.push("| # | Phase | Exit Question |")
  lines.push("|---|-------|--------------|")
  config.phases.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.name} | ${p.exit_question} |`)
  })

  if (config.size_presets !== undefined) {
    lines.push("")
    lines.push("### Size Skip Rules")
    lines.push("")
    lines.push("| Type | Phases Used |")
    lines.push("|------|-------------|")
    for (const [key, presetRaw] of Object.entries(config.size_presets)) {
      const preset = presetRaw
      if (preset.phases !== undefined) {
        lines.push(`| ${key} | ${preset.phases.join(", ")} |`)
      } else if (preset.skip !== undefined) {
        const skipSet = preset.skip
        const included = config.phases
          .filter((p) => !skipSet.includes(p.id))
          .map((p) => p.id)
        lines.push(`| ${key} | ${included.join(", ")} |`)
      }
    }
  }

  return lines.join("\n")
}

const slotKeyToDirName = (key: string): string =>
  key.replace(/_/g, "-")

export interface MachineLoaderContract {
  readonly loadPreset: (
    name: string,
  ) => Effect.Effect<typeof MachineConfig.Type, MachineLoadError>
  readonly loadFromFile: (
    filePath: string,
  ) => Effect.Effect<typeof MachineConfig.Type, MachineLoadError, FileSystem>
  readonly generate: (
    config: typeof MachineConfig.Type,
    targetDir: string,
    options?: { readonly force?: boolean },
  ) => Effect.Effect<ReadonlyArray<GeneratedFile>, never, FileSystem | Path>
}

export class MachineLoader extends Context.Service<MachineLoader, MachineLoaderContract>()("@anakmagang/MachineLoader") {
  static readonly layer = Layer.succeed(MachineLoader, {
    loadPreset: Effect.fn("MachineLoader.loadPreset")(function* (name: string) {
        const preset = BUNDLED_PRESETS[name]
        if (preset === undefined) {
          return yield* new MachineLoadError({
            source: `preset:${name}`,
            message: `Unknown preset "${name}". Available: ${Object.keys(BUNDLED_PRESETS).join(", ")}`,
          })
        }
        return yield* Schema.decodeUnknownEffect(MachineConfig)(preset).pipe(
          Effect.mapError((e) => new MachineLoadError({
            source: `preset:${name}`,
            message: `Preset schema validation failed: ${String(e)}`,
          }))
        )
      }),

    loadFromFile: Effect.fn("MachineLoader.loadFromFile")(function* (filePath: string) {
        const fs = yield* FileSystem
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError(
            () =>
              new MachineLoadError({
                source: filePath,
                message: `Could not read file: ${filePath}`,
              }),
          ),
        )
        const plain = Yaml.parse(content)
        return yield* Schema.decodeUnknownEffect(MachineConfig)(plain).pipe(
          Effect.mapError(
            (e) =>
              new MachineLoadError({
                source: filePath,
                message: `Schema validation failed: ${String(e)}`,
              }),
          ),
        )
      }),

    generate: Effect.fn("MachineLoader.generate")(function* (config: typeof MachineConfig.Type, targetDir: string, options?: { readonly force?: boolean }) {
        const fs = yield* FileSystem
        const path = yield* Path
        const force = options?.force ?? false

        const ensureDir = (dir: string) =>
          fs.makeDirectory(dir, { recursive: true }).pipe(Effect.orDie)

        const fileExists = (fp: string) =>
          fs.exists(fp).pipe(Effect.orDie)

        const writeFile = (fp: string, content: string) =>
          fs.writeFileString(fp, content).pipe(Effect.orDie)

        const readFile = (fp: string) =>
          fs.readFileString(fp).pipe(Effect.orDie)

        const writeIfMissing = (fp: string, content: string): Effect.Effect<GeneratedFile, never, never> =>
          Effect.gen(function* () {
            const exists = yield* fileExists(fp)
            if (exists) return { path: fp, status: "skipped" as const }
            yield* ensureDir(path.dirname(fp))
            yield* writeFile(fp, content)
            return { path: fp, status: "created" as const }
          })

        const writeOrUpdate = (fp: string, content: string): Effect.Effect<GeneratedFile, never, never> =>
          Effect.gen(function* () {
            const exists = yield* fileExists(fp)
            yield* ensureDir(path.dirname(fp))
            yield* writeFile(fp, content)
            return { path: fp, status: exists ? "updated" as const : "created" as const }
          })

        const ensureDirResult = (dirPath: string): Effect.Effect<GeneratedFile, never, never> =>
          Effect.gen(function* () {
            const exists = yield* fileExists(dirPath)
            if (exists) return { path: dirPath, status: "skipped" as const }
            yield* ensureDir(dirPath)
            return { path: dirPath, status: "created" as const }
          })

        const configPath = path.join(targetDir, ".anakmagang", "config.yaml")
        const configYaml = Yaml.prettyPrintDoc(Yaml.doc(configToYaml(config))) + "\n"

        const outDir = path.join(targetDir, ".anakmagang", "out")

        const stateSlots = Object.entries(config.state)
          .filter(([_, slot]) => slot.per !== "singleton")
          .map(([key]) => path.join(outDir, slotKeyToDirName(key)))

        const configResult = yield* (force ? writeOrUpdate(configPath, configYaml) : writeIfMissing(configPath, configYaml))

        const slotResults = yield* Effect.forEach(stateSlots, (dirPath) =>
          ensureDirResult(dirPath),
        )

        const claudeResult = yield* Effect.gen(function* () {
          const claudePath = path.join(targetDir, "CLAUDE.md")
          const exists = yield* fileExists(claudePath)
          const phaseSection = generatePhaseTable(config)

          if (!exists) {
            yield* writeFile(claudePath, `# Project\n\n${phaseSection}\n`)
            return { path: claudePath, status: "created" as const }
          }
          const existing = yield* readFile(claudePath)
          if (existing.includes("## Orchestration Phases")) {
            return { path: claudePath, status: "skipped" as const }
          }
          yield* writeFile(claudePath, `${existing.trimEnd()}\n\n${phaseSection}\n`)
          return { path: claudePath, status: "updated" as const }
        })

        const archResult = yield* writeIfMissing(
          path.join(targetDir, "ARCHITECTURE.md"),
          [
            "# Architecture",
            "",
            "## Domain Routing",
            "",
            "| Domain | Worker Agent | Verification |",
            "|--------|-------------|-------------|",
            "| | | |",
            "",
            "## Conventions",
            "",
            "<!-- Define project conventions here -->",
            "",
          ].join("\n"),
        )

        return [configResult, ...slotResults, claudeResult, archResult]
      }),
  })
}
