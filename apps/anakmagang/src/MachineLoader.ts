import { Context, Effect, Layer, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import * as Yaml from "./Yaml";
import * as Markdown from "./Markdown";
import {
  type StatuslineConfigType,
  MachineConfig,
  type SizePresetConfig,
  type SlotStore,
  type MemoryStoreEntry,
  type ArtifactStore,
  type Store,
  type FlowConfig,
  type RuntimeConfig,
  type RuntimeMemoryConfig,
  type GuardConfigSchema,
  type DomainRouteConfig,
} from "./Machine";

export {
  MachineConfig,
  OnAdvanceCommand,
  type StatuslineConfigType,
  ProviderConfig,
} from "./Machine";

export const ORCHESTRATE_PRESET: typeof MachineConfig.Type = {
  name: "orchestrate",
  version: 1,
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
    ],
    routing: [
      {
        domain: "Darwin modules",
        patterns: ["nix/modules/darwin/**/*.nix", "nix/configurations/darwin/*.nix"],
        worker: "nix-coder",
      },
      {
        domain: "Home modules",
        patterns: ["nix/modules/home/**/*.nix", "nix/configurations/home/*.nix"],
        worker: "nix-coder",
      },
      {
        domain: "NixOS modules",
        patterns: ["nix/modules/nixos/**/*.nix", "nix/configurations/nixos/*.nix"],
        worker: "nix-coder",
      },
      { domain: "Cross modules", patterns: ["nix/modules/cross/**/*.nix"], worker: "nix-coder" },
      {
        domain: "Flake modules",
        patterns: ["nix/modules/flake/**/*.nix", "nix/default.nix", "flake.nix"],
        worker: "nix-coder",
      },
      { domain: "Overlays", patterns: ["nix/overlays/**/*.nix"], worker: "nix-coder" },
      { domain: "Packages", patterns: ["nix/packages/**/default.nix"], worker: "nix-coder" },
      { domain: "Neovim", patterns: ["nix/nvim.nix/**/*.nix"], worker: "nix-coder" },
      { domain: "TypeScript apps", patterns: ["apps/**/*.ts"], worker: "effect-ts" },
      { domain: "Secrets", patterns: ["secrets/*.yaml", ".sops.yaml"], worker: "default" },
      { domain: "Code review", patterns: ["nix/**/*.nix", "flake.nix"], worker: "nix-reviewer" },
      { domain: "Docs/scripts", patterns: ["*.md", "*.sh", "*.lua", "*.yaml"], worker: "default" },
    ],
    providers: [
      {
        id: "claude",
        directory: ".claude",
        memories_dir: "memories",
        skills_dir: "skills",
        agents_dir: "agents",
        settings_file: "settings.json",
      },
      {
        id: "mistral",
        directory: ".vibe",
        memories_dir: "memories",
        skills_dir: "skills",
        agents_dir: "agents",
        settings_file: "config.toml",
        hooks_file: "hooks.toml",
        env_vars: {
          CLAUDE_PROJECT_DIR: "VIBE_WORKDIR",
        },
      },
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
      exit_question: "What assumptions am I carrying? What did past feedback tell me?",
      next: "triage",
      actions: ["read_manifest", "read_feedback"],
    },
    {
      id: "triage",
      name: "Triage",
      exit_question:
        "Am I solving the right problem? Does my size reflect behavioral impact, not just code volume? Could a 1-line change here break contracts, alter defaults, or shift observable behavior — making it MEDIUM regardless of diff size?",
      next: "discovery",
      skip_when: ["TRIVIAL"],
    },
    {
      id: "discovery",
      name: "Discovery",
      exit_question: "Am I anchoring on the first thing I found, or did I search broadly enough?",
      next: "skill_discovery",
    },
    {
      id: "skill_discovery",
      name: "Skill Discovery",
      exit_question: "Do I have the right tools, or am I forcing familiar ones onto this problem?",
      next: "complexity",
    },
    {
      id: "complexity",
      name: "Complexity Analysis",
      exit_question: "What am I underestimating? What unknown could derail this?",
      next: "brainstorming",
      skip_when: ["TRIVIAL", "SMALL", "MEDIUM"],
    },
    {
      id: "brainstorming",
      name: "Brainstorming",
      exit_question: "Are these genuinely different approaches, or variations of the same idea?",
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
      exit_question: "Did I delegate with enough context? Could the worker misinterpret my intent?",
      next: "design_verification",
    },
    {
      id: "design_verification",
      name: "Design Verification",
      exit_question: "Did the implementation drift from the design? Why?",
      next: "domain_compliance",
      skip_when: ["TRIVIAL", "SMALL"],
    },
    {
      id: "domain_compliance",
      name: "Domain Compliance",
      exit_question: "Am I checking rules mechanically, or understanding their intent?",
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
      exit_question: "Am I testing what matters, or what's easy to test?",
      next: "testing",
    },
    {
      id: "testing",
      name: "Testing",
      exit_question: "Do these checks prove correctness, or just exercise code paths?",
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
      actions: ["write_feedback_summary", "extract_memories", "update_manifest"],
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
      timeout: 5,
      routes: { ".nix": "/gateway-nix" },
    },
    {
      type: "output-location",
      description: "Writes constrained to project directory",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Edit|Write",
      timeout: 5,
      restricted_paths: ["secrets/secret.yaml", ".sops.yaml"],
      restricted_prefixes: ["result/"],
    },
    {
      type: "compaction-gate",
      description: "Block agent spawning at high context usage",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Agent",
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
      type: "post-edit",
      description: "Auto-verify nix files after edit",
      enforced_by: "hook",
      event: "PostToolUse",
      matcher: "Edit|Write",
      timeout: 30,
      file_pattern: "\\.nix$",
      command: "nix flake check --no-build",
    },
    {
      type: "inject-reminders",
      description: "Inject phase reminders on user prompt",
      enforced_by: "hook",
      event: "UserPromptSubmit",
      timeout: 5,
      reminders: ["Route Nix work via /gateway-nix. Use /orchestrate for non-trivial tasks."],
    },
    {
      type: "agent-stop-guard",
      description: "Ensure worker verified changes and emitted completion promise",
      enforced_by: "hook",
      event: "SubagentStop",
      timeout: 5,
      verification_rules: [
        {
          file_pattern: "\\.nix\\b",
          required_commands: ["nix eval", "nix flake check", "nix flake show", "nix fmt", "nixfmt"],
          message:
            "Worker modified .nix files but did not run nix verification.\nRun 'nix flake check --no-build' or 'nix eval' before stopping.",
        },
      ],
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
    },
    {
      type: "session-stop-guard",
      description: "Prevent session end with incomplete task",
      enforced_by: "hook",
      event: "Stop",
      timeout: 5,
    },
    {
      type: "command-substitute",
      description: "Block npm/pnpm/yarn — use bun instead",
      enforced_by: "hook",
      event: "PreToolUse",
      matcher: "Bash",
      timeout: 5,
      rules: [
        { contains: ["npm", "pnpm", "yarn"], should: "bun" },
        { contains: ["npx", "pnpx"], should: "bunx" },
        { contains: ["nix-instantiate"], should: "nix eval" },
        {
          contains: ["darwin-rebuild switch"],
          should: "darwin-rebuild switch --dry-run",
          unless_contains: "--dry-run",
        },
      ],
    },
    {
      type: "reflection-required",
      description: "Exit question must be answered before phase transition",
      enforced_by: "manifest",
    },
    {
      type: "reflection-required",
      description: "Exit question must be answered before phase transition (internal)",
      enforced_by: "manifest",
      event: "PhaseTransition",
      timeout: 5,
    },
  ],
  size_presets: {
    TRIVIAL: {
      phases: ["setup", "implementation", "completion"],
      criteria: ["No behavioral change — typo, comment, formatting, docs only"],
    },
    SMALL: {
      skip: ["complexity", "brainstorming", "architecture", "design_verification", "code_quality"],
      criteria: [
        "Single behavioral change, isolated blast radius",
        "No contract/interface/default changes",
        "Bug fix or mechanical refactor within existing patterns",
      ],
    },
    MEDIUM: {
      skip: ["complexity"],
      criteria: [
        "Changes contracts, defaults, control flow, or observable output — regardless of diff size",
        "New feature (any size) = MEDIUM minimum",
        "1 char changing behavior = MEDIUM, not SMALL",
      ],
    },
    LARGE: {
      phases: ["all"],
      criteria: [
        "New subsystem or cross-platform changes",
        "Architectural changes affecting multiple modules",
      ],
    },
  },
  rules: [
    "Routing is the source of truth: All domain\u2192worker mappings are defined in the machine's routing table (Ground algebra)",
    "Coordinator NEVER uses Edit/Write tools: This is a hard constraint. All file modifications go through worker agents",
    "Preserve comments: Never drop existing comments during code edits if they're still valid",
    "Pre-commit hooks handle formatting \u2014 don't run formatters manually",
    "Observe everything: Every issue, failure, or unexpected result gets recorded to session feedback",
    "Reflect at every transition: Answer the meta-cognitive question before moving phases. Act on low-confidence answers.",
  ],
  directives: [
    "CONTEXT DECAY AWARENESS: After 10+ messages in a conversation, you MUST re-read any file before editing it. Do not trust your memory of file contents. Auto-compaction may have silently destroyed that context.",
    "FILE READ BUDGET: Each file read is capped at 2,000 lines. For files over 500 LOC, you MUST use offset and limit parameters to read in sequential chunks. Never assume you have seen a complete file from a single read.",
    "TOOL RESULT BLINDNESS: Tool results over 50,000 characters are silently truncated to a preview. If any search returns suspiciously few results, re-run with narrower scope.",
    "SUB-AGENT SWARMING: For tasks touching >5 independent files, launch parallel sub-agents (5-8 files per agent). Each agent gets its own context window.",
    "EDIT INTEGRITY: Before EVERY file edit, re-read the file. After editing, read it again to confirm the change applied correctly. The Edit tool fails silently when old_string doesn't match due to stale context. Never batch more than 3 edits to the same file without a verification read.",
    "NO SEMANTIC SEARCH: You have grep, not an AST. When renaming or changing any function/option/variable, search separately for: direct references, module imports, option declarations, option usages, test references.",
    "FORCED VERIFICATION: Workers are FORBIDDEN from reporting a task as complete until they have run verification commands. If verification fails, fix before reporting.",
    "STEP 0: Dead code accelerates context compaction. Before any structural refactor on a file >300 LOC, first remove unused options, dead imports, and commented-out code. Commit cleanup separately.",
    "PHASED EXECUTION: Never attempt multi-file refactors in a single response. Break into phases of max 5 files. Complete one phase, verify, then proceed.",
  ],
};

const BUNDLED_PRESETS: Record<string, typeof MachineConfig.Type> = {
  orchestrate: ORCHESTRATE_PRESET,
};

export class MachineLoadError extends Schema.TaggedErrorClass<MachineLoadError>()(
  "MachineLoadError",
  {
    source: Schema.String,
    message: Schema.String,
  },
) {}

export interface GeneratedFile {
  readonly path: string;
  readonly status: "created" | "skipped" | "updated";
}

const optionalEntry = (key: string, value: string | number | boolean | undefined) =>
  value !== undefined ? [{ key, value: Yaml.scalar(value) }] : [];

const optionalListEntry = (key: string, items: ReadonlyArray<string> | undefined) =>
  items !== undefined && items.length > 0
    ? [{ key, value: Yaml.list(items.map(Yaml.scalar)) }]
    : [];

const storeToYaml = (store: typeof Store.Type): Yaml.YamlValue => {
  switch (store.kind) {
    case "Slot":
      return Yaml.map([
        { key: "kind", value: Yaml.scalar("Slot") },
        { key: "name", value: Yaml.scalar(store.name) },
        { key: "per", value: Yaml.scalar(store.per) },
        {
          key: "tracks",
          value: Yaml.map(
            Object.entries(store.tracks).map(([k, v]) => ({ key: k, value: Yaml.scalar(v) })),
          ),
        },
      ]);
    case "Memory":
      return Yaml.map([
        { key: "kind", value: Yaml.scalar("Memory") },
        { key: "name", value: Yaml.scalar(store.name) },
        { key: "path", value: Yaml.scalar(store.path) },
        { key: "budget", value: Yaml.scalar(store.budget) },
      ]);
    case "Artifact":
      return Yaml.map([
        { key: "kind", value: Yaml.scalar("Artifact") },
        { key: "name", value: Yaml.scalar(store.name) },
        { key: "path", value: Yaml.scalar(store.path) },
        { key: "writable", value: Yaml.scalar(store.writable) },
      ]);
  }
};

const flowToYaml = (flow: typeof FlowConfig.Type): Yaml.YamlValue =>
  Yaml.map([
    { key: "from", value: Yaml.scalar(flow.from) },
    { key: "to", value: Yaml.scalar(flow.to) },
    { key: "trigger", value: Yaml.scalar(flow.trigger) },
    ...optionalEntry("description", flow.description),
  ]);

const routingToYaml = (routes: ReadonlyArray<typeof DomainRouteConfig.Type>): Yaml.YamlValue =>
  Yaml.list(
    routes.map((r) =>
      Yaml.map([
        { key: "domain", value: Yaml.scalar(r.domain) },
        { key: "patterns", value: Yaml.list(r.patterns.map(Yaml.scalar)) },
        { key: "worker", value: Yaml.scalar(r.worker) },
      ]),
    ),
  );

const runtimeMemoryToYaml = (mem: typeof RuntimeMemoryConfig.Type): Yaml.YamlValue =>
  Yaml.map([
    { key: "scales", value: Yaml.list(mem.scales.map(Yaml.scalar)) },
    { key: "states", value: Yaml.list(mem.states.map(Yaml.scalar)) },
    {
      key: "stale_thresholds",
      value: Yaml.map(
        Object.entries(mem.stale_thresholds).map(([k, v]) => ({ key: k, value: Yaml.scalar(v) })),
      ),
    },
    {
      key: "promotion",
      value: Yaml.map([
        { key: "min_sources", value: Yaml.scalar(mem.promotion.min_sources) },
        { key: "auto", value: Yaml.scalar(mem.promotion.auto) },
      ]),
    },
    {
      key: "graph",
      value: Yaml.map([
        { key: "edge_types", value: Yaml.list(mem.graph.edge_types.map(Yaml.scalar)) },
        { key: "max_depth", value: Yaml.scalar(mem.graph.max_depth) },
        { key: "max_fan_out", value: Yaml.scalar(mem.graph.max_fan_out) },
        { key: "max_query_nodes", value: Yaml.scalar(mem.graph.max_query_nodes) },
      ]),
    },
  ]);

const statuslineToYaml = (sl: StatuslineConfigType): Yaml.YamlValue =>
  Yaml.map([
    ...(sl.segments !== undefined && sl.segments.length > 0
      ? [
          {
            key: "segments",
            value: Yaml.list(
              sl.segments.map((seg) =>
                Yaml.map([
                  { key: "id", value: Yaml.scalar(seg.id) },
                  { key: "source", value: Yaml.scalar(seg.source) },
                  ...optionalEntry("format", seg.format),
                  ...optionalEntry("render", seg.render),
                  ...optionalEntry("display", seg.display),
                  ...optionalEntry("width", seg.width),
                  ...(seg.thresholds !== undefined
                    ? [{ key: "thresholds", value: Yaml.list(seg.thresholds.map(Yaml.scalar)) }]
                    : []),
                  ...optionalEntry("cache", seg.cache),
                ]),
              ),
            ),
          },
        ]
      : []),
    ...(sl.layout !== undefined && sl.layout.length > 0
      ? [
          {
            key: "layout",
            value: Yaml.list(sl.layout.map((line) => Yaml.list(line.map(Yaml.scalar)))),
          },
        ]
      : []),
    ...optionalEntry("separator", sl.separator),
    ...(sl.presets !== undefined
      ? [
          {
            key: "presets",
            value: Yaml.map(
              Object.entries(sl.presets).map(([k, v]) => ({
                key: k,
                value: v === "all" ? Yaml.scalar("all") : Yaml.list(v.map(Yaml.scalar)),
              })),
            ),
          },
        ]
      : []),
    ...optionalEntry("active", sl.active),
    ...optionalEntry("refresh_interval", sl.refresh_interval),
  ]);

const phasesToYaml = (phases: (typeof MachineConfig.Type)["phases"]) => [
  {
    key: "phases",
    value: Yaml.list(
      phases.map((phase) =>
        Yaml.map([
          { key: "id", value: Yaml.scalar(phase.id) },
          { key: "name", value: Yaml.scalar(phase.name) },
          { key: "exit_question", value: Yaml.scalar(phase.exit_question) },
          { key: "next", value: Yaml.scalar(phase.next) },
          ...optionalListEntry("actions", phase.actions),
          ...optionalListEntry("skip_when", phase.skip_when),
          ...(phase.on_advance !== undefined && phase.on_advance.length > 0
            ? [
                {
                  key: "on_advance",
                  value: Yaml.list(
                    phase.on_advance.map((cmd) =>
                      Yaml.map([
                        { key: "command", value: Yaml.scalar(cmd.command) },
                        ...(cmd.file_pattern !== undefined
                          ? [{ key: "file_pattern", value: Yaml.scalar(cmd.file_pattern) }]
                          : []),
                      ]),
                    ),
                  ),
                },
              ]
            : []),
        ]),
      ),
    ),
  },
];

const transitionsToYaml = (transitions: (typeof MachineConfig.Type)["transitions"]) =>
  transitions !== undefined && transitions.length > 0
    ? [
        {
          key: "transitions",
          value: Yaml.list(
            transitions.map((t) =>
              Yaml.map([
                { key: "from", value: Yaml.scalar(t.from) },
                { key: "to", value: Yaml.scalar(t.to) },
                ...optionalEntry("when", t.when),
                ...optionalEntry("description", t.description),
              ]),
            ),
          ),
        },
      ]
    : [];

const guardsToYaml = (guards: (typeof MachineConfig.Type)["guards"]) =>
  guards !== undefined && guards.length > 0
    ? [
        {
          key: "guards",
          value: Yaml.list(
            guards.map((g) =>
              Yaml.map([
                { key: "type", value: Yaml.scalar(g.type) },
                ...optionalEntry("description", g.description),
                ...optionalEntry("enforced_by", g.enforced_by),
                ...optionalEntry("event", g.event),
                ...optionalEntry("matcher", g.matcher),
                ...optionalEntry("timeout", g.timeout),
                ...optionalEntry("max", g.max),
                ...optionalEntry("warn_at", g.warn_at),
                ...optionalEntry("enabled", g.enabled),
                ...optionalEntry("skill", g.skill),
                ...(g.rules !== undefined && g.rules.length > 0
                  ? [
                      {
                        key: "rules",
                        value: Yaml.list(
                          g.rules.map((r) =>
                            Yaml.map([
                              { key: "contains", value: Yaml.list(r.contains.map(Yaml.scalar)) },
                              { key: "should", value: Yaml.scalar(r.should) },
                            ]),
                          ),
                        ),
                      },
                    ]
                  : []),
              ]),
            ),
          ),
        },
      ]
    : [];

const sizePresetsToYaml = (presets: (typeof MachineConfig.Type)["size_presets"]) =>
  presets !== undefined
    ? [
        {
          key: "size_presets",
          value: Yaml.map(
            Object.entries(presets).map(([key, preset]) => ({
              key,
              value: Yaml.map([
                ...optionalListEntry("phases", preset.phases),
                ...optionalListEntry("skip", preset.skip),
                ...optionalListEntry("criteria", preset.criteria),
              ]),
            })),
          ),
        },
      ]
    : [];

const experimentalToYaml = (experimental: (typeof MachineConfig.Type)["experimental"]) =>
  experimental !== undefined && experimental.length > 0
    ? [
        {
          key: "experimental",
          value: Yaml.list(
            experimental.map((e) =>
              Yaml.map([
                { key: "id", value: Yaml.scalar(e.id) },
                { key: "enabled", value: Yaml.scalar(e.enabled) },
                ...optionalEntry("description", e.description),
                { key: "prompt", value: Yaml.scalar(e.prompt) },
              ]),
            ),
          ),
        },
      ]
    : [];

export const configToYaml = (config: typeof MachineConfig.Type) =>
  Yaml.map([
    { key: "name", value: Yaml.scalar(config.name) },
    { key: "version", value: Yaml.scalar(config.version) },
    {
      key: "ground",
      value: Yaml.map([
        { key: "stores", value: Yaml.list(config.ground.stores.map(storeToYaml)) },
        ...(config.ground.flows !== undefined && config.ground.flows.length > 0
          ? [{ key: "flows", value: Yaml.list(config.ground.flows.map(flowToYaml)) }]
          : []),
        ...(config.ground.routing !== undefined && config.ground.routing.length > 0
          ? [{ key: "routing", value: routingToYaml(config.ground.routing) }]
          : []),
        ...(config.ground.statusline !== undefined
          ? [{ key: "statusline", value: statuslineToYaml(config.ground.statusline) }]
          : []),
      ]),
    },
    {
      key: "runtime",
      value: Yaml.map([{ key: "memory", value: runtimeMemoryToYaml(config.runtime.memory) }]),
    },
    ...phasesToYaml(config.phases),
    ...transitionsToYaml(config.transitions),
    ...guardsToYaml(config.guards),
    ...sizePresetsToYaml(config.size_presets),
    ...experimentalToYaml(config.experimental),
    ...(config.rules !== undefined && config.rules.length > 0
      ? [{ key: "rules", value: Yaml.list(config.rules.map(Yaml.scalar)) }]
      : []),
    ...(config.directives !== undefined && config.directives.length > 0
      ? [{ key: "directives", value: Yaml.list(config.directives.map(Yaml.scalar)) }]
      : []),
  ]);

const generatePhaseTable = (config: typeof MachineConfig.Type) => {
  const phaseTable = Markdown.table(
    ["#", "Phase", "Exit Question"],
    config.phases.map((p, i) => [`${i + 1}`, p.name, p.exit_question]),
  );

  const sizeRules =
    config.size_presets !== undefined
      ? [
          Markdown.heading(3, "Size Skip Rules"),
          Markdown.table(
            ["Type", "Phases Used"],
            Object.entries(config.size_presets).flatMap(([key, preset]) => {
              if (preset.phases !== undefined) {
                return [[key, preset.phases.join(", ")]];
              }
              if (preset.skip !== undefined) {
                const skipSet = preset.skip;
                const included = config.phases
                  .filter((p) => !skipSet.includes(p.id))
                  .map((p) => p.id);
                return [[key, included.join(", ")]];
              }
              return [];
            }),
          ),
        ]
      : [];

  return Markdown.prettyPrintMdDoc(
    Markdown.mdDoc(Markdown.heading(2, "Orchestration Phases"), phaseTable, ...sizeRules),
  );
};

const generateSkillContent = (config: typeof MachineConfig.Type): string => {
  const phaseCount = config.phases.length;
  const phaseTable = generatePhaseTable(config);

  return `# ${phaseCount}-Phase Orchestration Protocol

## When to use

Every non-trivial task. This is the master workflow that governs how work moves from request to completion.

## State Interface

All state operations go through \`anakmagang\` CLI:
- **Read**: \`anakmagang state\` (coordinator runs directly)
- **Machine events** (coordinator runs directly):
  - \`anakmagang start "<task>"\` → creates session at phase 1/setup, returns exit question
  - \`anakmagang eval "<reflection>" --session <id>\` → evaluate transition (machine computes direction)
  - \`anakmagang eval "<reflection>" --session <id> --size <SIZE>\` → complete setup with size classification
  - \`anakmagang eval "<reflection>" --session <id> --confidence low\` → signal low confidence for back-loop
  - \`anakmagang observe "<text>" --session <id>\` → records observation without advancing phase

${phaseTable}

## Steps

1. **Load state** — Run \`anakmagang state\` to check for in-progress work.
2. **Classify the task** — Determine size based on behavioral impact, not code volume.
3. **Start the machine** — Run \`anakmagang start "<task>"\`. The machine creates a session at phase 1/setup and returns the exit question.
4. **Complete setup** — After doing Setup work (read memories, past feedback), classify the task size and run \`anakmagang eval "<reflection>" --session $SID --size <SIZE>\` to complete setup.
5. **Execute remaining phases** — For each active phase, do the work, answer the exit question: \`anakmagang eval "<answer>" --session $SID\`
6. **Record observations** — Use \`anakmagang observe "<text>" --session $SID\` at any time without advancing phase.

## State Management

State is managed by the \`anakmagang\` machine. The coordinator drives transitions via machine events:

\`\`\`bash
anakmagang start "task description"                                # start at phase 1/setup
anakmagang eval "reflection" --session $SID --size SMALL           # complete setup with size
anakmagang eval "answer to exit question" --session $SID           # evaluate transition
anakmagang observe "discovered X" --session $SID                   # record without advancing
\`\`\`

## Notes

- Always check CLAUDE.md rules during Domain Compliance
- If a phase produces no actionable output, note "N/A" and move on
`;
};

const generateSlotSection = (stores: ReadonlyArray<typeof Store.Type>) => {
  const slots = stores.filter((s): s is typeof SlotStore.Type => s.kind === "Slot");
  if (slots.length === 0) return "";
  const slotLines = slots.map(
    (s) =>
      `- **${s.name}** (${s.per}): ${Object.entries(s.tracks)
        .map(([k]) => k)
        .join(", ")}`,
  );
  const cliDocs = [
    "### CLI Commands",
    "",
    "All state operations go through the `anakmagang` CLI:",
    "",
    "- `anakmagang state` — list sessions",
    "- `anakmagang state <session-id>` — full session state",
    '- `anakmagang start "<task>"` — create session at phase 1/setup',
    '- `anakmagang eval "<reflection>" --session <id>` — evaluate transition (machine computes direction)',
    '- `anakmagang eval "<reflection>" --session <id> --size <SIZE>` — complete setup with size classification',
    '- `anakmagang observe "<text>" --session <id>` — record observation without advancing',
  ];
  return `## State Interface\n\n${slotLines.join("\n")}\n\n${cliDocs.join("\n")}\n`;
};

const generateGuardsSection = (
  guards: ReadonlyArray<typeof GuardConfigSchema.Type> | undefined,
) => {
  if (guards === undefined || guards.length === 0) return "";
  const lines = guards.map((g) => `- **${g.type}**: ${g.description ?? ""}`);
  return `## Guards\n\n${lines.join("\n")}\n`;
};

const generateSizeClassification = (
  presets: Record<string, typeof SizePresetConfig.Type> | undefined,
) => {
  if (presets === undefined) return "";
  const lines = Object.entries(presets).map(([key, preset]) => {
    const criteria =
      preset.criteria !== undefined ? preset.criteria.map((c) => `  - ${c}`).join("\n") : "";
    return `- **${key}**${criteria.length > 0 ? `\n${criteria}` : ""}`;
  });
  return `## Size Classification\n\n${lines.join("\n")}\n`;
};

const generateCoordinatorProtocol = (
  guards: ReadonlyArray<typeof GuardConfigSchema.Type> | undefined,
) => {
  if (guards === undefined || guards.length === 0) return "";
  const agentFirst = guards.find((g) => g.type === "agent-first");
  if (agentFirst === undefined) return "";

  const lines = [
    "## Coordinator Protocol (Kernel Mode)",
    "",
    "You are the **coordinator**. You plan, delegate, verify, **observe**, **reflect**. You do NOT edit code directly.",
    "",
    "> **FIRST ACTION on every task**: Run the orchestration skill to classify the task size and begin phase tracking.",
    "",
    "### Tool Restriction Boundary",
    "",
    "| Thread | Has | Does NOT have |",
    "|--------|-----|---------------|",
    "| Coordinator (you) | Read, Glob, Grep, Bash (verify only) | Edit, Write, NotebookEdit (delegate instead) |",
    "| Workers (domain-specific) | Edit, Write, Bash | Agent (cannot delegate) |",
    "",
    '**This boundary is absolute.** No skill or workflow overrides it. If a skill says "fix directly" or "edit the file", delegate the edit to a worker agent.',
    "",
  ];
  return lines.join("\n");
};

const generateMetaCognitiveProtocol = (config: typeof MachineConfig.Type) => {
  if (config.phases.length === 0) return "";

  const phaseQuestions = Markdown.table(
    ["Phase", "Exit Question"],
    config.phases.map((p) => [p.name, `"${p.exit_question}"`]),
  );

  const backLoop =
    config.transitions !== undefined
      ? config.transitions.filter((t) => t.when === "confidence_low")
      : [];

  const lines = [
    "### Meta-Cognitive Protocol",
    "",
    "The coordinator **reflects** at every phase transition. Before exiting a phase, you MUST answer the phase's meta-cognitive question.",
    "",
    "**This is not optional.** The guards will surface the question on every prompt.",
    "",
    "#### Phase Questions",
    "",
    Markdown.prettyPrintMdDoc(Markdown.mdDoc(phaseQuestions)),
    "",
    "#### How to reflect",
    "",
    "**This is a hard enforcement.** Every `anakmagang eval` call MUST include a genuine answer to the phase's exit question. Violations:",
    '- Empty string `""` \u2192 NOT acceptable',
    '- Generic filler (`"done"`, `"ok"`, `"moving on"`) \u2192 NOT acceptable',
    "- Answer that doesn't address the specific question \u2192 NOT acceptable",
    "",
    "The reflection MUST:",
    "1. **Directly answer the exit question** \u2014 restate the question's concern and respond to it honestly",
    "2. Be a short, honest statement (1-3 sentences) \u2014 not a checkbox exercise",
    "3. Name specific evidence \u2014 files read, patterns found, assumptions identified, risks acknowledged",
    "4. If confidence is low, say so explicitly \u2014 then **act on it** before proceeding",
    "",
    ...(backLoop.length > 0
      ? [
          `When confidence is low, the machine loops back (${backLoop.map((t) => `${t.from} \u2192 ${t.to}`).join(", ")}).`,
          "",
        ]
      : []),
  ];

  return lines.join("\n");
};

const generateSessionFeedback = (stores: ReadonlyArray<typeof Store.Type>) => {
  const feedback = stores.find(
    (s): s is typeof SlotStore.Type =>
      s.kind === "Slot" &&
      s.per === "session" &&
      ("reflections" in s.tracks || "observations" in s.tracks),
  );
  if (feedback === undefined) return "";
  return [
    "### Session Feedback (Observer Role)",
    "",
    "The coordinator **observes** every tool call, delegation, and verification result throughout the session.",
    "",
    "**When to record:**",
    '- On any issue: run `anakmagang eval "<description>" --session <id> --observe`',
    '- At phase transitions: run `anakmagang eval "<reflection>" --session <id>` (machine evaluates and transitions)',
    '- At completion: run `anakmagang eval "<summary>" --session <id> --observe`',
    "",
    "**Reading past feedback:**",
    "- Run `anakmagang state` to see all sessions",
    "- Run `anakmagang state <session-id>` for specific session feedback",
    "",
  ].join("\n");
};

const generateCompletionPromises = (
  guards: ReadonlyArray<typeof GuardConfigSchema.Type> | undefined,
) => {
  if (guards === undefined) return "";
  const stopGuard = guards.find((g) => g.type === "agent-stop-guard");
  if (
    stopGuard === undefined ||
    stopGuard.promises === undefined ||
    stopGuard.promises.length === 0
  )
    return "";

  const domainPromises = stopGuard.promises.filter((p) => !p.startsWith("REVIEW_"));
  const reviewPromises = stopGuard.promises.filter((p) => p.startsWith("REVIEW_"));

  const lines = [
    "### Completion Promises",
    "",
    "Worker agents MUST include exactly one signal string in their final message:",
    ...(domainPromises.length > 0
      ? [`- ${domainPromises.map((p) => `\`${p}\``).join(" / ")} (domain workers)`]
      : []),
    ...(reviewPromises.length > 0
      ? [`- ${reviewPromises.map((p) => `\`${p}\``).join(" / ")} (review workers)`]
      : []),
    "",
  ];
  return lines.join("\n");
};

const generateTaskNotes = (stores: ReadonlyArray<typeof Store.Type>) => {
  const feedback = stores.find(
    (s): s is typeof SlotStore.Type =>
      s.kind === "Slot" &&
      s.per === "session" &&
      ("reflections" in s.tracks || "observations" in s.tracks),
  );
  if (feedback === undefined) return "";
  return [
    "### Task Notes",
    "",
    "For persistent task notes, use observations:",
    '- `anakmagang eval "approach: tried X, failed because Y" --session <id> --observe`',
    '- `anakmagang eval "finding: discovered Z" --session <id> --observe`',
    '- `anakmagang eval "decision: chose A over B because C" --session <id> --observe`',
    "",
    "Observations are appended to the session's manifest.yaml event log.",
    "",
  ].join("\n");
};

const generateRulesSection = (rules: ReadonlyArray<string> | undefined) => {
  if (rules === undefined || rules.length === 0) return "";
  const lines = rules.map((r) => {
    const colonIdx = r.indexOf(":");
    if (colonIdx > 0 && colonIdx < 40) {
      const key = r.substring(0, colonIdx).trim();
      const desc = r.substring(colonIdx + 1).trim();
      return `- **${key}**: ${desc}`;
    }
    return `- ${r}`;
  });
  return `## Rules\n\n${lines.join("\n")}\n`;
};

const generateDirectivesSection = (directives: ReadonlyArray<string> | undefined) => {
  if (directives === undefined || directives.length === 0) return "";

  const isContext = (d: string) => {
    const upper = d.toUpperCase();
    return (
      upper.includes("CONTEXT") ||
      upper.includes("FILE READ") ||
      upper.includes("TOOL RESULT") ||
      upper.includes("SWARMING")
    );
  };
  const isEdit = (d: string) => {
    const upper = d.toUpperCase();
    return upper.includes("EDIT") || upper.includes("SEMANTIC") || upper.includes("VERIFICATION");
  };

  const contextDirectives = directives.filter(isContext);
  const editDirectives = directives.filter((d) => !isContext(d) && isEdit(d));
  const workDirectives = directives.filter((d) => !isContext(d) && !isEdit(d));

  const formatDirective = (d: string) => {
    const colonIdx = d.indexOf(":");
    if (colonIdx > 0 && colonIdx < 30) {
      const key = d.substring(0, colonIdx).trim();
      const desc = d.substring(colonIdx + 1).trim();
      return `- **${key}**: ${desc}`;
    }
    return `- ${d}`;
  };

  const sections = [
    "## Agent Directives",
    "",
    "Mechanical overrides for context management and edit safety.",
    "",
    ...(contextDirectives.length > 0
      ? ["### Context Management", "", ...contextDirectives.map(formatDirective), ""]
      : []),
    ...(editDirectives.length > 0
      ? ["### Edit Safety", "", ...editDirectives.map(formatDirective), ""]
      : []),
    ...(workDirectives.length > 0
      ? ["### Pre-Work", "", ...workDirectives.map(formatDirective), ""]
      : []),
  ];
  return sections.join("\n");
};

const generateMemorySection = (
  stores: ReadonlyArray<typeof Store.Type>,
  flows: ReadonlyArray<typeof FlowConfig.Type> | undefined,
  runtime: typeof RuntimeConfig.Type,
  phases: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly next: string | null;
  }>,
) => {
  const mems = stores.filter((s): s is typeof MemoryStoreEntry.Type => s.kind === "Memory");
  if (mems.length === 0) return "";

  const memPaths = mems.map((m) => m.path);
  const memBudgets = mems.map((m) => `- **${m.name}** (\`${m.path}\`)`);

  const completionPhase = phases.find((p) => p.next === null || p.id === "completion");
  const phaseLabel = completionPhase
    ? `phase ${phases.indexOf(completionPhase) + 1} (${completionPhase.name})`
    : "the final phase";

  const memoryFlows = (flows ?? []).filter((f) => mems.some((m) => m.name === f.to));
  const pipelineLines =
    memoryFlows.length > 0
      ? [
          "### Feedback \u2192 Memory pipeline",
          "",
          `At ${phaseLabel}, after finalizing session feedback:`,
          "1. Read the session's feedback observations and reflections",
          "2. Extract anything reusable across future sessions (not task-specific)",
          "3. Delegate writing/updating the appropriate memory file",
          "4. Low-confidence reflections that recur across sessions \u2192 create a memory to address the uncertainty",
          "",
        ]
      : [];

  const scaleLines =
    runtime.memory.scales.length > 0
      ? [`Memory scales: ${runtime.memory.scales.join(" \u2192 ")}`]
      : [];

  return [
    "## Memory",
    "",
    `Write project memories to \`${memPaths[0]}/\` (tracked in git, shared across sessions).`,
    "",
    "The `anakmagang` CLI provides memory management:",
    '- `anakmagang memory create <name> -T <type> -d "<description>"` \u2014 create a memory node',
    '- `anakmagang memory query "<keywords>"` \u2014 search memories by keyword',
    "- `anakmagang memory status` \u2014 list all memory nodes with state",
    "- `anakmagang memory promote <id>` \u2014 promote a memory's scale",
    "- `anakmagang memory prune` \u2014 mark stale memories for archival",
    "",
    ...memBudgets,
    "",
    ...scaleLines,
    "",
    ...pipelineLines,
  ].join("\n");
};

const generateWorkflow = (config: typeof MachineConfig.Type) => {
  if (config.phases.length === 0) return "";

  return [
    "## Workflow",
    "",
    "1. Run `anakmagang state` \u2014 load current session state",
    '2. Run `anakmagang start "<task>"` \u2014 machine creates session at phase 1/setup',
    "3. Read memories, past feedback \u2014 do Setup work",
    "4. Classify task size (TRIVIAL / SMALL / MEDIUM / LARGE)",
    '5. Run `anakmagang eval "<reflection>" --session <id> --size <SIZE>` \u2014 completes setup, machine computes active phases',
    '6. At each subsequent phase: do the work, then run `anakmagang eval "<reflection>" --session <id>` to advance (or loop back if confidence is low)',
    '7. Run `anakmagang eval "<issue>" --session <id> --observe` when issues occur',
    "8. Delegate implementation to workers via domain gateway",
    "9. Run verification commands (coordinator verifies)",
    "",
  ].join("\n");
};

const generateGuardrails = (guards: ReadonlyArray<typeof GuardConfigSchema.Type> | undefined) => {
  if (guards === undefined || guards.length === 0) return "";

  const iterLimit = guards.find((g) => g.type === "iteration-limit");

  const items = [
    ...(guards.some((g) => g.type === "agent-first")
      ? ["**Coordinator NEVER uses Edit/Write tools**: Enforced by `agent-first` guard"]
      : []),
    "**Coordinator drives the machine**: Uses `anakmagang start/eval` for phase transitions",
    "**Workers NEVER delegate**: They implement, they don't coordinate",
    ...(iterLimit !== undefined
      ? [
          `**Iteration limit enforced**: ${iterLimit.max !== undefined ? `Max ${iterLimit.max} per task` : "Per task per agent"}`,
        ]
      : []),
    ...(guards.some((g) => g.type === "output-location")
      ? ["**Output paths enforced**: All writes within project directory"]
      : []),
    ...(guards.some((g) => g.type === "agent-stop-guard")
      ? ["**Completion promises required**: Workers must emit signal strings"]
      : []),
    "**State via CLI only**: `anakmagang state` to read, `anakmagang start/eval` for transitions",
    ...(guards.some((g) => g.type === "reflection-required")
      ? [
          "**Reflections are mandatory**: Every phase transition requires answering the meta-cognitive question",
          '**Low confidence = action required**: A "low" confidence reflection means something is wrong',
        ]
      : []),
  ];

  return `## Guardrails\n\n${items.map((i) => `- ${i}`).join("\n")}\n`;
};

const generateSessionState = (stores: ReadonlyArray<typeof Store.Type>) => {
  const feedback = stores.find(
    (s): s is typeof SlotStore.Type =>
      s.kind === "Slot" &&
      s.per === "session" &&
      ("reflections" in s.tracks || "observations" in s.tracks),
  );
  if (feedback === undefined) return "";
  return [
    "## Session State",
    "",
    "On every new conversation, run `anakmagang state` to load session context.",
    "",
    "Session state is append-only. All state (current task, phase, reflections, etc.) is derived from the event log.",
    "",
  ].join("\n");
};

type Scenario = "fresh" | "scaffold" | "existing" | "initialized" | "migration";

const scenarioPreamble = (scenario: Scenario, foundLegacy: ReadonlyArray<string>): string => {
  switch (scenario) {
    case "fresh":
      return "This is a new project with no anakmagang configuration. All files will be created from scratch.";
    case "scaffold":
      return "anakmagang init was previously run but setup is incomplete. Missing files will be created; existing files will be preserved.";
    case "existing":
      return "This project has existing configuration (CLAUDE.md, .claude/) but was not initialized with anakmagang. **Important: Respect all existing files.** Read each existing file before modifying. If unsure about any change, ask the user before proceeding.";
    case "initialized":
      return "This project has a complete anakmagang setup. Review each file for correctness and completeness. Verify configuration matches the expected state. Enrich any sections that are incomplete.";
    case "migration":
      return `Legacy patterns detected: ${foundLegacy.map((p) => `\`${p}\``).join(", ")}. These need to be migrated to the current structure. **Ask the user before proceeding with migration.**`;
  }
};

const fileAction = (scenario: Scenario, exists: boolean): string => {
  if (!exists) return "**Create** this file with the following content:";
  switch (scenario) {
    case "existing":
      return "**Review** the existing file. If it differs from the expected content below, **ask the user** before replacing. Expected content:";
    case "initialized":
      return "**Verify** the existing file matches the expected content. If sections are missing or incomplete, **enrich** by merging. Expected content:";
    case "scaffold":
      return "**Update** this file with the following content (scaffold will be replaced):";
    case "fresh":
    case "migration":
      return "Write the following content:";
  }
};

const stepVerb = (scenario: Scenario, exists: boolean): string => {
  if (!exists) return "Create";
  switch (scenario) {
    case "existing":
      return "Review";
    case "initialized":
      return "Verify";
    case "scaffold":
      return "Update";
    case "fresh":
    case "migration":
      return "Create";
  }
};

const migrationSteps = (foundLegacy: ReadonlyArray<string>): string => {
  const migrations: ReadonlyArray<{ from: string; to: string; desc: string }> = [
    { from: ".data/references/", to: ".anakmagang/references/", desc: "move directory" },
    { from: ".data/", to: ".anakmagang/", desc: "if applicable" },
    { from: ".claude/.output/", to: ".anakmagang/out/", desc: "session output directory" },
    { from: ".claude/config/", to: ".anakmagang/", desc: "configuration files" },
  ];
  const relevant = migrations.filter((m) =>
    foundLegacy.some((p) => m.from.startsWith(p) || p.startsWith(m.from.replace(/\/$/, ""))),
  );
  const migrationLines =
    relevant.length > 0
      ? relevant.map((m) => `- \`${m.from}\` -> \`${m.to}\` (${m.desc})`)
      : foundLegacy.map((p) => `- \`${p}\` -> needs manual migration`);

  return [
    "## Step 0: Migration",
    "",
    "Legacy patterns detected that should be migrated:",
    ...migrationLines,
    "",
    "**Ask the user before executing any migration.** Some paths may contain important data.",
    "",
    "For each migration:",
    "1. Verify source exists and target does not",
    "2. Move contents: `mv <source> <target>`",
    "3. Update any references in existing files",
  ].join("\n");
};

export const generateInstructions = Effect.fn("MachineLoader.generateInstructions")(function* (
  config: typeof MachineConfig.Type,
  targetDir: string,
) {
  const fs = yield* FileSystem;
  const path = yield* Path;

  const fileExists = (rel: string) =>
    fs.exists(path.join(targetDir, rel)).pipe(Effect.orElseSucceed(() => false));

  const statusLabel = (rel: string) =>
    Effect.map(fileExists(rel), (e) => (e ? "\u2713 exists" : "\u2717 missing"));

  const stores = config.ground.stores;
  const mems = stores.filter((s): s is typeof MemoryStoreEntry.Type => s.kind === "Memory");
  const artifacts = stores.filter((s): s is typeof ArtifactStore.Type => s.kind === "Artifact");
  const dirs = [...mems, ...artifacts];

  const expectedPaths: Array<{ expected: string; rel: string }> = [
    { expected: "Config", rel: ".anakmagang/config.yaml" },
    ...mems.map((m) => ({ expected: `Memory dir (${m.name})`, rel: m.path })),
    ...artifacts.map((a) => ({ expected: `Artifact dir (${a.name})`, rel: a.path })),
    { expected: "Hooks", rel: ".claude/settings.json" },
    { expected: "Skills", rel: ".claude/skills/orchestrate/SKILL.md" },
    { expected: "Router", rel: "CLAUDE.md" },
  ];

  const stateRows = yield* Effect.forEach(expectedPaths, (ep) =>
    Effect.map(statusLabel(ep.rel), (s) => `| ${ep.expected} | ${ep.rel} | ${s} |`),
  );

  const stateSection = [
    "## Current State",
    "",
    "| Expected | Path | Status |",
    "|----------|------|--------|",
    ...stateRows,
  ].join("\n");

  // --- Scenario detection ---

  const hasConfig = yield* fileExists(".anakmagang/config.yaml");
  const hasClaudeMd = yield* fileExists("CLAUDE.md");
  const hasSettings = yield* fileExists(".claude/settings.json");
  const hasSkill = yield* fileExists(".claude/skills/orchestrate/SKILL.md");

  const legacyPaths = [".data", ".data/references", ".claude/.output", ".claude/config"] as const;
  const legacyHits = yield* Effect.forEach(legacyPaths, (p) =>
    Effect.map(fileExists(p), (exists): string | undefined => (exists ? p : undefined)),
  );
  const foundLegacy = legacyHits.filter((p): p is string => p !== undefined);

  const scenario: Scenario =
    foundLegacy.length > 0
      ? "migration"
      : hasConfig && hasClaudeMd && hasSettings && hasSkill
        ? "initialized"
        : hasConfig && !hasClaudeMd
          ? "scaffold"
          : !hasConfig && (hasClaudeMd || hasSettings)
            ? "existing"
            : "fresh";

  // --- Derived file contents ---

  const claudeSections = [
    `# ${config.name}\n`,
    generateSlotSection(config.ground.stores),
    generateSessionState(config.ground.stores),
    generateCoordinatorProtocol(config.guards),
    generateMetaCognitiveProtocol(config),
    generateSessionFeedback(config.ground.stores),
    generatePhaseTable(config),
    generateSizeClassification(config.size_presets),
    generateGuardsSection(config.guards),
    generateCompletionPromises(config.guards),
    generateTaskNotes(config.ground.stores),
    generateRulesSection(config.rules),
    generateDirectivesSection(config.directives),
    generateMemorySection(config.ground.stores, config.ground.flows, config.runtime, config.phases),
    generateWorkflow(config),
    generateGuardrails(config.guards),
  ].filter((s) => s.length > 0);
  const claudeContent = claudeSections.join("\n") + "\n";
  const claudeExists = yield* fileExists("CLAUDE.md");

  // --- Scaffold step (scenario-aware) ---

  const scaffoldPreamble = (s: Scenario): string => {
    switch (s) {
      case "fresh":
        return "Run these commands to scaffold the project:";
      case "scaffold":
        return "Some files already exist. Run to create remaining:";
      case "existing":
        return "**Review existing files first.** Then run to create missing machine-managed files:";
      case "initialized":
        return "All machine-managed files exist. Verify with:";
      case "migration":
        return "After completing migration, run to create missing machine-managed files:";
    }
  };

  const scaffoldNote =
    scenario === "initialized"
      ? "> Use `anakmagang init --force` to regenerate all machine-managed files."
      : [
          "> These commands are idempotent — they skip files that already exist.",
          "> Use `anakmagang init --force` to overwrite existing files.",
        ].join("\n");

  const managedFileCount = 4 + dirs.length + artifacts.length;

  const scaffoldStep = 1;
  const claudeStep = 2;

  const steps = [
    ...(scenario === "migration" ? [migrationSteps(foundLegacy)] : []),
    [
      `## Step ${scaffoldStep}: Scaffold`,
      "",
      scaffoldPreamble(scenario),
      "",
      "```bash",
      "anakmagang init            # creates config.yaml, CLAUDE.md, SKILL.md, dirs, .gitignore",
      "anakmagang hook sync       # creates .claude/settings.json from guards",
      "```",
      "",
      scaffoldNote,
    ].join("\n"),
    [
      `## Step ${claudeStep}: ${stepVerb(scenario, claudeExists)} CLAUDE.md`,
      "",
      `> Path: \`CLAUDE.md\``,
      `> Status: ${claudeExists ? "\u2713 exists" : "\u2717 missing"}`,
      "",
      fileAction(scenario, claudeExists),
      "",
      "```markdown",
      claudeContent.trimEnd(),
      "```",
    ].join("\n"),
  ];

  // --- Summary ---

  const claudeAction = claudeExists ? (scenario === "initialized" ? "verify" : "review") : "create";
  const migrationCount = foundLegacy.length;

  const summaryCounts =
    [
      `Scenario: ${scenario}`,
      `run \`anakmagang init\` to scaffold ${managedFileCount} machine-managed files`,
      `CLAUDE.md: ${claudeAction}`,
      ...(migrationCount > 0
        ? [`${migrationCount} migration path${migrationCount > 1 ? "s" : ""}`]
        : []),
    ].join(", ") + ".";

  const summary = ["## Summary", "", summaryCounts].join("\n");

  const scenarioSection = [
    "## Scenario",
    "",
    `**${scenario}**: ${scenarioPreamble(scenario, foundLegacy)}`,
  ].join("\n");

  const sections = [
    `# anakmagang: Setup Instructions for \`${config.name}\`\n`,
    stateSection + "\n",
    scenarioSection + "\n",
    ...steps.map((s) => s + "\n"),
    summary + "\n",
  ];

  return sections.join("\n");
});

export interface MachineLoaderContract {
  readonly loadPreset: (name: string) => Effect.Effect<typeof MachineConfig.Type, MachineLoadError>;
  readonly loadFromFile: (
    filePath: string,
  ) => Effect.Effect<typeof MachineConfig.Type, MachineLoadError, FileSystem>;
  readonly generate: (
    config: typeof MachineConfig.Type,
    targetDir: string,
    options?: { readonly force?: boolean },
  ) => Effect.Effect<ReadonlyArray<GeneratedFile>, MachineLoadError, FileSystem | Path>;
}

export class MachineLoader extends Context.Service<MachineLoader, MachineLoaderContract>()(
  "@anakmagang/MachineLoader",
) {
  static readonly layer = Layer.succeed(
    MachineLoader,
    MachineLoader.of({
      loadPreset: Effect.fn("MachineLoader.loadPreset")(function* (name: string) {
        const preset = BUNDLED_PRESETS[name];
        if (preset === undefined) {
          return yield* new MachineLoadError({
            source: `preset:${name}`,
            message: `Unknown preset "${name}". Available: ${Object.keys(BUNDLED_PRESETS).join(", ")}`,
          });
        }
        return yield* Schema.decodeUnknownEffect(MachineConfig)(preset).pipe(
          Effect.mapError(
            (e) =>
              new MachineLoadError({
                source: `preset:${name}`,
                message: `Preset schema validation failed: ${String(e)}`,
              }),
          ),
        );
      }),

      loadFromFile: Effect.fn("MachineLoader.loadFromFile")(function* (filePath: string) {
        const fs = yield* FileSystem;
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError(
            () =>
              new MachineLoadError({
                source: filePath,
                message: `Could not read file: ${filePath}`,
              }),
          ),
        );
        const plain = Yaml.parse(content);
        return yield* Schema.decodeUnknownEffect(MachineConfig)(plain).pipe(
          Effect.mapError(
            (e) =>
              new MachineLoadError({
                source: filePath,
                message: `Schema validation failed: ${String(e)}`,
              }),
          ),
        );
      }),

      generate: Effect.fn("MachineLoader.generate")(function* (
        config: typeof MachineConfig.Type,
        targetDir: string,
        options?: { readonly force?: boolean },
      ) {
        const fs = yield* FileSystem;
        const path = yield* Path;
        const force = options?.force ?? false;

        const ensureDir = (dir: string) =>
          fs.makeDirectory(dir, { recursive: true }).pipe(
            Effect.mapError(
              () =>
                new MachineLoadError({
                  source: dir,
                  message: "Failed to create directory: " + dir,
                }),
            ),
          );

        const fileExists = (fp: string) => fs.exists(fp).pipe(Effect.orElseSucceed(() => false));

        const writeFile = (fp: string, content: string) =>
          fs
            .writeFileString(fp, content)
            .pipe(
              Effect.mapError(
                () => new MachineLoadError({ source: fp, message: "Failed to write file: " + fp }),
              ),
            );

        const readFile = (fp: string) =>
          fs
            .readFileString(fp)
            .pipe(
              Effect.mapError(
                () => new MachineLoadError({ source: fp, message: "Failed to read file: " + fp }),
              ),
            );

        const generated = (fp: string, status: GeneratedFile["status"]): GeneratedFile => ({
          path: fp,
          status,
        });

        const writeIfMissing = (fp: string, content: string) =>
          Effect.gen(function* () {
            const exists = yield* fileExists(fp);
            if (exists) return generated(fp, "skipped");
            yield* ensureDir(path.dirname(fp));
            yield* writeFile(fp, content);
            return generated(fp, "created");
          });

        const writeOrUpdate = (fp: string, content: string) =>
          Effect.gen(function* () {
            const exists = yield* fileExists(fp);
            yield* ensureDir(path.dirname(fp));
            yield* writeFile(fp, content);
            return generated(fp, exists ? "updated" : "created");
          });

        const ensureDirResult = (dirPath: string) =>
          Effect.gen(function* () {
            const exists = yield* fileExists(dirPath);
            if (exists) return generated(dirPath, "skipped");
            yield* ensureDir(dirPath);
            return generated(dirPath, "created");
          });

        const configPath = path.join(targetDir, ".anakmagang", "config.yaml");
        const configYaml = Yaml.prettyPrintDoc(Yaml.doc(configToYaml(config))) + "\n";

        const configResult = yield* force
          ? writeOrUpdate(configPath, configYaml)
          : writeIfMissing(configPath, configYaml);

        const initGround = Effect.gen(function* () {
          const storeResults = yield* Effect.forEach(
            config.ground.stores.filter((s) => s.kind === "Memory" || s.kind === "Artifact"),
            (store) =>
              Effect.gen(function* () {
                const dp = path.join(targetDir, store.path);
                const r = yield* ensureDirResult(dp);
                return { result: r, gitignore: store.kind === "Artifact" ? store.path : undefined };
              }),
          );
          return {
            results: storeResults.map((s) => s.result),
            gitignoreEntries: storeResults
              .filter((s) => s.gitignore !== undefined)
              .map((s) => s.gitignore ?? ""),
          };
        });

        const initDynamics = (skillsDir: string) =>
          Effect.gen(function* () {
            const phaseContent = generateSkillContent(config);
            const orchestrateDir = path.join(skillsDir, "orchestrate");
            yield* fs
              .makeDirectory(orchestrateDir, { recursive: true })
              .pipe(Effect.orElseSucceed(() => {}));
            const skillPath = path.join(orchestrateDir, "SKILL.md");
            const orchestrateResult = yield* writeIfMissing(skillPath, phaseContent + "\n");
            const skillGuards = (config.guards ?? []).filter((g) => g.skill !== undefined);
            const guardResults = yield* Effect.forEach(skillGuards, (g) =>
              Effect.gen(function* () {
                const guardSkillDir = path.join(skillsDir, g.skill ?? "");
                yield* fs
                  .makeDirectory(guardSkillDir, { recursive: true })
                  .pipe(Effect.orElseSucceed(() => {}));
                const sp = path.join(guardSkillDir, "SKILL.md");
                const content = `# ${g.skill}\n\nSkill for guard: ${g.type}\n${g.description ?? ""}\n`;
                return yield* writeIfMissing(sp, content);
              }),
            );
            return [orchestrateResult, ...guardResults];
          });

        const initRouter = Effect.gen(function* () {
          const claudePath = path.join(targetDir, "CLAUDE.md");
          const sections = [
            `# ${config.name}\n`,
            generateSlotSection(config.ground.stores),
            generateSessionState(config.ground.stores),
            generateCoordinatorProtocol(config.guards),
            generateMetaCognitiveProtocol(config),
            generateSessionFeedback(config.ground.stores),
            generatePhaseTable(config),
            generateSizeClassification(config.size_presets),
            generateGuardsSection(config.guards),
            generateCompletionPromises(config.guards),
            generateTaskNotes(config.ground.stores),
            generateRulesSection(config.rules),
            generateDirectivesSection(config.directives),
            generateMemorySection(
              config.ground.stores,
              config.ground.flows,
              config.runtime,
              config.phases,
            ),
            generateWorkflow(config),
            generateGuardrails(config.guards),
          ].filter((s) => s.length > 0);
          const content = sections.join("\n") + "\n";
          return yield* force
            ? writeOrUpdate(claudePath, content)
            : writeIfMissing(claudePath, content);
        });

        const mergeGitignore = (entries: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            if (entries.length === 0) return [];
            const giPath = path.join(targetDir, ".gitignore");
            const exists = yield* fileExists(giPath);
            const existing = exists ? yield* readFile(giPath) : "";
            const missing = entries.filter((e) => !existing.includes(e));
            if (missing.length === 0) return [generated(giPath, "skipped")];
            const addition = missing.map((e) => `${e}/`).join("\n");
            const newContent =
              existing.length > 0 ? `${existing.trimEnd()}\n${addition}\n` : `${addition}\n`;
            yield* writeFile(giPath, newContent);
            return [generated(giPath, exists ? "updated" : "created")];
          });

        const { results: groundResults, gitignoreEntries } = yield* initGround;
        const skillsDir = path.join(targetDir, ".claude", "skills");
        const dynamicsResults = yield* initDynamics(skillsDir);
        const routerResult = yield* initRouter;
        const gitignoreResults = yield* mergeGitignore(gitignoreEntries);

        return [
          configResult,
          ...groundResults,
          ...dynamicsResults,
          routerResult,
          ...gitignoreResults,
        ];
      }),
    }),
  );
}
