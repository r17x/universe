---
name: Anakmagang
description: Comprehensive architecture — deterministic AI orchestration CLI with state-machine-as-data, fractal memory, and supply chain audit
type: reference
created: 2026-04-24
updated: 2026-05-03
---

# Anakmagang — Architecture & Design

*anakmagang* (Indonesian: 'intern/apprentice') — the AI orchestration tooling that learns alongside you.

---

## Mission

**Shift the R17{x} Universe from "trust humans to follow rules" to "tools enforce rules and remember what worked."**

```
Deterministic, observable AI orchestration
  └─ Tooling that validates, wraps, and remembers
      └─ Three subsystems unified under one CLI
          └─ Effect-TS services + Bun runtime
```

**Problem:** The 16-phase orchestration protocol generates knowledge at every phase, but:
- Agent/skill definitions accumulate without validation
- Knowledge is trapped in session-scoped feedback files
- Each session cold-starts without prior context

**What it replaces:**
- Manual `grep` for agent/skill validation → `anakmagang audit`
- Manual feedback file extraction → `anakmagang memory`

**Who it serves (priority order):**
1. R17 (developer) — quality gate + knowledge base
2. Claude (coordinator) — persistent context + type-safe tools
3. Worker agents — indirect compliance feedback
4. Future contributors — self-service onboarding

**Anti-patterns:**
- DO NOT position anakmagang as a replacement for CLAUDE.md — it enforces what CLAUDE.md declares
- DO NOT build features for hypothetical users — R17 and Claude are the only confirmed users
- DO NOT conflate audit (static analysis) with enforcement (runtime blocking)

---

## Categorical Foundations

anakmagang IS the data model. Every command — `init`, `audit`, `memory` — is an interpretation of one algebraic structure. The state machine preset is not a feature; it is the core type from which everything derives.

### Categorical Insight

anakmagang forms a **small category**:

- **Objects** = states (phases, memory lifecycle, audit checks)
- **Morphisms** = guarded, effectful transitions between states
- **Identity** = staying in the current state (no-op transition)
- **Composition** = sequential transitions: `(A → B) ∘ (B → C) = (A → C)`

Commands are **functors** from this category into the category of Effects:

```
init   : Machine → Artifact     (free functor — generates structure)
run    : Machine → Effect       (Kleisli functor — executes transitions)
status : Machine → Report       (forgetful functor — observes state)
audit  : Machine → Judgment     (evaluation functor — validates against rules)
```

The machine definition (preset) is the **initial algebra** — the universal object from which all interpretations (commands) factor uniquely.

### Categorical Reference (Haskell Formal Spec)

```haskell
{-# LANGUAGE GADTs, DataKinds, TypeFamilies, RankNTypes #-}

module Anakmagang.Core where

-- ================================================================
-- The Mealy Machine: the universal type of anakmagang
-- ================================================================

-- | A Machine parameterized by four type variables.
--   This is THE type. Everything else is an instance.
--
--   Categorically: a coalgebra of the functor
--   F(X) = (event → Maybe (action, X))
--
--   s = state space
--   e = event space (what triggers transitions)
--   g = guard space (predicates on transitions)
--   a = action space (effects on transitions)
data Machine s e g a = Machine
  { states     :: [s]
  , transition :: s -> e -> Maybe s
  , guards     :: s -> e -> [g]
  , actions    :: s -> e -> s -> [a]
  , initial    :: s
  , isFinal    :: s -> Bool
  }

-- | Run a machine: the universal interpreter.
--   This is a catamorphism — the unique morphism from the initial algebra.
run :: Monad m
    => Machine s e g a
    -> (g -> m Bool)          -- guard evaluator
    -> (a -> m ())            -- action executor
    -> s                      -- current state
    -> e                      -- incoming event
    -> m (Maybe s)            -- next state (Nothing = blocked)
run m evalGuard execAction cur evt = do
  let gs = guards m cur evt
  allPass <- and <$> traverse evalGuard gs
  case (allPass, transition m cur evt) of
    (True, Just next) -> do
      traverse_ execAction (actions m cur evt next)
      pure (Just next)
    _ -> pure Nothing
```

### Domain Instances

Each subsystem instantiates `Machine` with its own types. The structure is identical — only the type parameters change.

#### Orchestration

```haskell
module Anakmagang.Orchestration where

data Phase
  = Setup | Triage | Discovery | SkillDiscovery
  | Complexity | Brainstorming | Architecture
  | Implementation | DesignVerification | DomainCompliance
  | CodeQuality | TestPlanning | Testing
  | Coverage | TestQuality | Completion
  deriving (Eq, Ord, Enum, Bounded, Show)

data OrcEvent
  = Advance Confidence        -- complete phase, move forward
  | Skip Size                 -- skip phase (task too small)
  | Retreat                   -- low confidence, go back
  | BackSignal BackEvent      -- subsystem feedback (DAG coupling)

data OrcGuard
  = ReflectionRecorded        -- exit question answered
  | ConfidenceAbove Level     -- reflection confidence threshold
  | SizePermits Phase Size    -- phase not skipped for this size

data OrcAction
  = ReadManifest
  | ReadFeedback
  | ReadArchitecture
  | WriteFeedback Reflection
  | WriteManifest ManifestPatch
  | DelegateToWorker Domain WorkSpec
  | RunVerification Command

data Confidence = High | Medium | Low
data Size = Trivial | Small | Medium_ | Large
data Level = AboveLow | AboveMedium

type Orchestration = Machine Phase OrcEvent OrcGuard OrcAction
```

#### Memory Lifecycle

```haskell
module Anakmagang.Memory where

data MemState = Active | Stale | Archived
  deriving (Eq, Show)

data MemEvent
  = SessionPassed             -- a session completed without accessing this node
  | Accessed                  -- node was read/referenced
  | PruneTriggered            -- prune command ran
  | PromoteTriggered Scale    -- promote to higher scale

data MemGuard
  = SessionCountAbove Int     -- stale threshold
  | ScaleBelow Scale          -- can only promote upward
  | ManualApproval            -- principles need human sign-off

data MemAction
  = IncrementSessionCount
  | ResetSessionCount
  | SetScale Scale
  | AddEdge EdgeType NodeId
  | WriteNode

data Scale = Observation | Finding | Learning | Principle
  deriving (Eq, Ord, Show)

type MemoryLifecycle = Machine MemState MemEvent MemGuard MemAction

-- The lifecycle machine (concrete instance)
memoryMachine :: MemoryLifecycle
memoryMachine = Machine
  { states     = [Active, Stale, Archived]
  , transition = \s e -> case (s, e) of
      (Active,   SessionPassed)      -> Just Active    -- increment count (guard checks threshold)
      (Active,   PruneTriggered)     -> Just Stale     -- only if session_count > threshold
      (Active,   PromoteTriggered _) -> Just Active    -- stays active, scale changes
      (Stale,    Accessed)           -> Just Active    -- re-activation
      (Stale,    PruneTriggered)     -> Just Archived  -- archive stale nodes
      (Archived, PromoteTriggered _) -> Just Active    -- manual recovery
      _                              -> Nothing
  , guards     = \s e -> case (s, e) of
      (Active, PruneTriggered)     -> [SessionCountAbove 5]
      (Active, PromoteTriggered s) -> [ScaleBelow s]
      (Archived, _)                -> [ManualApproval]
      _                            -> []
  , actions    = \s e s' -> case (s, e, s') of
      (Active, SessionPassed, Active)       -> [IncrementSessionCount, WriteNode]
      (Active, PruneTriggered, Stale)       -> [WriteNode]
      (Active, PromoteTriggered sc, Active) -> [SetScale sc, AddEdge DerivedFrom undefined, ResetSessionCount, WriteNode]
      (Stale, Accessed, Active)             -> [ResetSessionCount, WriteNode]
      (Stale, PruneTriggered, Archived)     -> [WriteNode]
      _                                     -> [WriteNode]
  , initial    = Active
  , isFinal    = (== Archived)
  }
```

#### Audit Pipeline

```haskell
module Anakmagang.Audit where

data AuditPhase
  = Frontmatter | ToolBoundary | Delegation | Verification
  | CompletionPromises | SkillRefs | SizeCheck
  | ArchAlignment | OutputFormat
  | AuditDone
  deriving (Eq, Ord, Enum, Bounded, Show)

data AuditEvent
  = CheckPassed
  | CheckWarned Text
  | CheckFailed Text

data AuditGuard
  = PreviousNotFailed         -- phase 1 failure gates the rest

data AuditAction
  = RecordResult AuditPhase Status Text
  | EmitReport

data Status = Pass | Warn | Fail

type AuditPipeline = Machine AuditPhase AuditEvent AuditGuard AuditAction
```

### Composition

Machines compose. This is what makes the unified model work — the full anakmagang runtime is a **product** of four machines running in concert.

```haskell
module Anakmagang.Compose where

-- | Product of two machines: parallel composition.
--   State = (s1, s2), Events = Either e1 e2
--   Each event advances only its own machine.
product :: Machine s1 e1 g1 a1
        -> Machine s2 e2 g2 a2
        -> Machine (s1, s2) (Either e1 e2) (Either g1 g2) (Either a1 a2)
product m1 m2 = Machine
  { states     = [(s1, s2) | s1 <- states m1, s2 <- states m2]
  , transition = \(s1, s2) ev -> case ev of
      Left  e1 -> fmap (\s1' -> (s1', s2)) (transition m1 s1 e1)
      Right e2 -> fmap (\s2' -> (s1, s2')) (transition m2 s2 e2)
  , guards     = \(s1, s2) ev -> case ev of
      Left  e1 -> map Left  (guards m1 s1 e1)
      Right e2 -> map Right (guards m2 s2 e2)
  , actions    = \(s1, s2) ev (s1', s2') -> case ev of
      Left  e1 -> map Left  (actions m1 s1 e1 s1')
      Right e2 -> map Right (actions m2 s2 e2 s2')
  , initial    = (initial m1, initial m2)
  , isFinal    = \(s1, s2) -> isFinal m1 s1 && isFinal m2 s2
  }

-- | DAG Coupling: subsystems signal back to orchestration only.
--   No Memory<->Audit. Orchestration is the hub.
--
--        Memory --> Orchestration <-- Audit

data BackEvent
  = AuditSignal AuditBackEvent
  | MemorySignal MemBackEvent

data AuditBackEvent  = AuditFailed Text | AuditBlocked
data MemBackEvent    = ConflictDetected NodeId NodeId | StaleContext

-- The full runtime: product of all machines, orchestration absorbs back-events
type Anakmagang = Machine
  (Phase, Map NodeId MemState, Maybe AuditPhase)
  AnakmagangEvent
  AnakmagangGuard
  AnakmagangAction

data AnakmagangEvent
  = OrcE OrcEvent
  | MemE NodeId MemEvent
  | AudE AuditEvent
  | BackE BackEvent           -- subsystem -> orchestration feedback

-- Back-events feed into orchestration's transition function:
--   BackE (AuditSignal (AuditFailed _))  -> retreat to implementation
--   BackE (MemorySignal (ConflictDetected _ _)) -> re-triage
```

### Commands as Functors

Every CLI command is a projection or functor from `Machine s e g a`. The four type parameters cover all commands — no additional types needed.

```haskell
module Anakmagang.Commands where

-- Each command projects a different facet of Machine s e g a

-- | init: Preset x RepoState -> [Artifact]
--   Functor from Machine to the category of FileSystems.
init :: Preset -> RepoState -> [Artifact]

data RepoState = Empty | Existing (Set ExistingArtifact)
data ExistingArtifact = HasClaude | HasHooks | HasManifest | HasArchitecture

-- | hook list: Machine -> [g]  — shows all guards
hookList :: Machine s e g a -> [g]

-- | hook <id>: Machine x State x HookEvent -> HookResult
hookEval :: Machine s e g a -> s -> HookEvent -> g -> HookResult

data HookEvent = PreToolUse Tool Input | PostToolUse Tool Output | PromptSubmit Text
data HookResult = Allow | Block Text | Warn Text

-- | status: Machine x State -> Report
status :: Machine s e g a -> s -> Report

-- | audit: AuditPipeline x Target -> Report
audit :: AuditPipeline -> FilePath -> IO AuditReport

-- | memory: MemoryLifecycle x Operation -> Node
memory :: MemoryLifecycle -> MemoryOp -> IO MemoryNode
```

All commands derive from `Machine s e g a`:

```
Machine s e g a
   |
   +-- s (states)    -> manifest tracks current state
   +-- e (events)    -> what triggers transitions
   +-- g (guards)    -> anakmagang hook list / hook <id>
   +-- a (actions)   -> transitions

CLI command tree:
   init    = Preset -> RepoState -> [Artifact]
   hook    = Machine -> g -> HookResult
   audit   = Machine -> [File] -> Report
   memory  = Machine -> MemOp -> Node
   status  = Machine -> s -> Report
```

### The Preset: Serialized Machine

A preset IS a `Machine` value, serialized to YAML. `anakmagang init` deserializes it and interprets via the `init` functor.

```haskell
module Anakmagang.Preset where

data Preset = Preset
  { name        :: Text
  , version     :: Int
  , phases      :: [PresetPhase]
  , transitions :: [PresetTransition]
  , guards      :: [PresetGuard]
  , sizePresets :: Map Size [Text]
  }

data PresetPhase = PresetPhase
  { phaseId      :: Text
  , phaseName    :: Text
  , exitQuestion :: Text
  , phaseActions :: [Text]
  , nextPhase    :: Maybe Text
  , skipWhen     :: [Size]
  }

-- | reify: Preset -> Machine  — LEFT ADJOINT to serialize
reify :: Preset -> Machine Text Text Text Text

-- | serialize: Machine -> Preset — RIGHT ADJOINT
serialize :: (Show s, Show e, Show g, Show a) => Machine s e g a -> Preset
```

### The Adjunction

`reify ⊣ serialize` forms an **adjunction** between Preset (serialized definitions) and Machine (typed, executable machines):

```
                reify
    Preset  --------->  Machine
       |                    |
       |   unit (embed)     |   counit (run)
       v                    v
    Preset  <---------  Machine
              serialize
```

This adjunction guarantees: **every command that works on `Machine` automatically works on any `Preset`**, via `reify`. No special cases per preset.

### Effect-TS Mapping

```
Haskell                    Effect-TS
-----------------------------------------------------------------
Machine s e g a            Schema.Struct (parameterized)
s (state)                  Schema.Literal union
e (event)                  Schema.TaggedUnion
g (guard)                  Effect.Effect<boolean>
a (action)                 Effect.Effect<void>
run                        Effect.gen(function*() { ... })
product                    Effect.all (parallel fibers)
Coupling                   Stream.tap / Effect.flatMap
Preset                     YAML parsed via frontmatter parser
reify                      Schema.decode (Preset -> Machine)
init                       effect/platform FileSystem writes
hookList                   Machine.guards projected as list
hookEval                   Effect.if / Effect.when (guard -> boolean)
status                     Effect.sync (read manifest, no transitions)
```

---

## State Machine Framework

Core idea: the orchestration protocol is **data**, not code. anakmagang reads a state machine definition and constructs the full harness — skills, hooks, CLAUDE.md protocol, manifest schema. This makes anakmagang portable across projects and publishable as OSS.

### Inversion

| Current | Proposed |
|---------|----------|
| 16-phase orchestration is hardcoded in skills/orchestrate.md | Orchestration is a state machine definition file |
| anakmagang is a tool inside the orchestration | anakmagang constructs the orchestration from data |
| Hooks are project-specific shell scripts | Guards are declared in the state machine, generated by init |
| CLAUDE.md protocol is hand-written | Protocol sections generated from machine definition |
| Porting to another project = copy files + adapt | Porting = `anakmagang init --from ./.anakmagang/config.yaml` |

### State Machine Definition Schema (.anakmagang/config.yaml)

```yaml
# .anakmagang/config.yaml — the portable unit
name: orchestrate
version: 1

phases:
  - id: setup
    name: Setup
    exit_question: "What assumptions am I carrying? What did past feedback tell me?"
    next: triage
    actions:
      - read_manifest
      - read_feedback
      - read_architecture

  - id: triage
    name: Triage
    exit_question: "Am I solving the right problem? Is my size classification honest or wishful?"
    next: discovery
    skip_when: [TRIVIAL]

  - id: discovery
    name: Discovery
    exit_question: "Am I anchoring on the first thing I found, or did I search broadly enough?"
    next: skill_discovery

  - id: skill_discovery
    name: Skill Discovery
    exit_question: "Do I have the right tools, or am I forcing familiar ones onto this problem?"
    next: complexity

  - id: complexity
    name: Complexity Analysis
    exit_question: "What am I underestimating? What unknown could derail this?"
    next: brainstorming
    skip_when: [TRIVIAL, SMALL, MEDIUM]

  - id: brainstorming
    name: Brainstorming
    exit_question: "Are these genuinely different approaches, or variations of the same idea?"
    next: architecture
    skip_when: [TRIVIAL, SMALL]

  - id: architecture
    name: Architecture
    exit_question: "Will this design survive edge cases I haven't imagined? Am I overengineering?"
    next: implementation
    skip_when: [TRIVIAL, SMALL]

  - id: implementation
    name: Implementation
    exit_question: "Did I delegate with enough context? Could the worker misinterpret my intent?"
    next: design_verification

  - id: design_verification
    name: Design Verification
    exit_question: "Did the implementation drift from the design? Why?"
    next: domain_compliance
    skip_when: [TRIVIAL, SMALL]

  - id: domain_compliance
    name: Domain Compliance
    exit_question: "Am I checking rules mechanically, or understanding their intent?"
    next: code_quality

  - id: code_quality
    name: Code Quality
    exit_question: "Would I be confident rebuilding the system right now? What makes me hesitate?"
    next: test_planning
    skip_when: [TRIVIAL, SMALL]

  - id: test_planning
    name: Test Planning
    exit_question: "Am I testing what matters, or what's easy to test?"
    next: testing

  - id: testing
    name: Testing
    exit_question: "Do these checks prove correctness, or just exercise code paths?"
    next: coverage

  - id: coverage
    name: Coverage Analysis
    exit_question: "What failure mode isn't covered? What would a real user do that I haven't tested?"
    next: test_quality

  - id: test_quality
    name: Test Quality
    exit_question: "Could these checks pass with subtly broken code? Are the assertions meaningful?"
    next: completion

  - id: completion
    name: Completion
    exit_question: "What would I do differently if I started over? What did this session teach me?"
    next: null
    actions:
      - write_feedback_summary
      - extract_memories
      - update_manifest

transitions:
  # Normal: forward through phase.next
  # Backward: any phase can go back when reflection reveals problems
  - from: "*"
    to: previous
    when: confidence_low
    description: "Low confidence reflection triggers re-evaluation"

guards:
  - type: agent-first
    description: "Coordinator never edits files directly"
    enforced_by: hook
    event: PreToolUse
    matcher: "Edit|Write"
    routes:
      ".nix": "/gateway-nix"

  - type: output-location
    description: "Writes constrained to project directory"
    enforced_by: hook
    event: PreToolUse
    matcher: "Edit|Write"
    restricted_paths:
      - "secrets/secret.yaml"
      - ".sops.yaml"
    restricted_prefixes:
      - "result/"

  - type: compaction-gate
    description: "Blocks agent spawn at high context usage"
    enforced_by: hook
    event: PreToolUse
    matcher: Agent

  - type: iteration-limit
    description: "Caps tool calls per task"
    max: 50
    warn_at: 40
    enforced_by: hook
    event: PreToolUse

  - type: command-substitute
    description: "Block forbidden commands — suggest alternatives"
    enforced_by: hook
    event: PreToolUse
    matcher: Bash
    rules:
      - contains: ["npm", "pnpm", "yarn"]
        should: bun
      - contains: ["npx", "pnpx"]
        should: bunx
      - contains: ["nix-instantiate"]
        should: nix eval
      - contains: ["darwin-rebuild switch"]
        should: darwin-rebuild switch --dry-run
        unless_contains: "--dry-run"

  - type: post-edit
    description: "Auto-verify nix files after edit"
    enforced_by: hook
    event: PostToolUse
    matcher: "Edit|Write"
    file_pattern: "\\.nix$"
    command: "nix flake check --no-build"

  - type: inject-reminders
    description: "Injects phase reminders into prompts"
    enforced_by: hook
    event: UserPromptSubmit
    reminders:
      - "Route Nix work via /gateway-nix. Use /orchestrate for non-trivial tasks."

  - type: agent-stop-guard
    description: "Ensures worker ran verification and emitted completion promise"
    enforced_by: hook
    event: SubagentStop
    verification_rules:
      - file_pattern: "\\.nix\\b"
        required_commands: ["nix eval", "nix flake check", "nix flake show", "nix fmt", "nixfmt"]
        message: "Run nix verification before stopping."
    promises:
      - IMPLEMENTATION_COMPLETE
      - VERIFICATION_PASSED
      - VERIFICATION_FAILED
      - IMPLEMENTATION_BLOCKED
      - NEEDS_COORDINATOR_INPUT
      - REVIEW_PASSED
      - REVIEW_ISSUES_FOUND
      - REVIEW_BLOCKED

  - type: session-stop-guard
    description: "Prevents session end with incomplete task"
    enforced_by: hook
    event: Stop

  - type: reflection-required
    description: "Exit question must be answered before phase transition"
    enforced_by: manifest
    event: PhaseTransition

size_presets:
  TRIVIAL:
    phases: [setup, implementation, completion]
  SMALL:
    skip: [complexity, brainstorming, architecture, design_verification, code_quality]
  MEDIUM:
    skip: [complexity]
  LARGE:
    phases: all
```

### Guard Types

10 guard types are implemented, each bound to a specific hook event:

| Guard | Event | Description |
|-------|-------|-------------|
| agent-first | PreToolUse | Coordinator cannot use Edit/Write directly; routes via config `routes` map |
| output-location | PreToolUse | Writes constrained to project directory; config-driven `restricted_paths`/`restricted_prefixes` |
| compaction-gate | PreToolUse | Blocks agent spawn at high context usage (>80% block, >75% warn) |
| iteration-limit | PreToolUse | Caps tool calls per task (configurable `max`/`warn_at`) |
| command-substitute | PreToolUse | Blocks commands matching configurable `rules` with `unless_contains` exemptions |
| post-edit | PostToolUse | Runs configurable `command` after file edits; optional `file_pattern` filter |
| inject-reminders | UserPromptSubmit | Injects task/phase/memory context; config-driven `reminders` array |
| agent-stop-guard | SubagentStop | Config-driven `verification_rules` + `promises` check on worker stop |
| session-stop-guard | Stop | Prevents session end with incomplete task (escape hatch after 2 blocks) |
| reflection-required | PhaseTransition | Exit question must be answered before phase transition |

### Presets

| Preset | Phases | Use Case |
|--------|--------|----------|
| `orchestrate` | 16 phases | Full deterministic orchestration (current R17x workflow) |
| `minimal` | 4 phases: plan → implement → verify → complete | Small projects, quick tasks |
| `review-only` | 3 phases: discover → review → report | Code review workflows |
| `blank` | 0 phases | Empty machine — define your own |

### `anakmagang init`

```bash
# From a preset
anakmagang init --preset orchestrate
anakmagang init --preset minimal

# From a custom definition
anakmagang init --from ./.anakmagang/config.yaml

# Into a target project
anakmagang init --preset minimal --target /path/to/project
```

#### What `init` generates

```
<project>/
  .claude/
    skills/
      orchestrate.md          # Generated from phases + transitions
    agents/
      # Not generated — project-specific
  .anakmagang/
    config.yaml              # Source definition (generated by init, committed)
  .anakmagang/
    manifest.yaml             # Initialized with machine's state schema
    out/                      # Session output (gitignored)
  CLAUDE.md                   # Protocol section injected/appended
  ARCHITECTURE.md             # Scaffold if missing
```

#### Generation Rules

| Machine element | Generated artifact |
|-----------------|-------------------|
| `phases[].exit_question` | Phase table in CLAUDE.md + orchestrate.md |
| `phases[].actions` | Action steps in orchestrate.md per phase |
| `phases[].skip_when` | Skip table in CLAUDE.md |
| `guards[]` | Hook scripts in hooks/ |
| `size_presets` | Size classification table in CLAUDE.md |
| `transitions` | Transition rules in orchestrate.md |

### Subsystem Integration

| Subsystem | Role in the machine |
|-----------|-------------------|
| `audit` | Runs at domain_compliance phase (or equivalent) |
| `memory` | Runs at setup (read) and completion (write) |
| `search` (fff-c) | Available to all phases via Search service |

The subsystems are **machine-agnostic** — they don't know which phases exist. The machine definition wires them in via `phases[].actions`.

---

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Bun | Fast startup, native TS, built-in bundler |
| Core | effect 4.x | Typed errors, services, layers, structured concurrency |
| CRDT | effect-crdts | STM-based CRDTs with file persistence via KeyValueStore — concurrent schema safety |
| CLI framework | @effect/cli | Command/Options/Args with Effect integration |
| Platform | @effect/platform-bun | FileSystem, Process, Terminal |
| Schema/Validation | effect/Schema | Idiomatic, zero extra deps, encodes/decodes |
| Output | @effect/printer | Structured terminal output (tables, colors) |
| Search | fff-c (bun:ffi) | Native fuzzy search — frecency, SIMD grep, content index, file watcher |

### Dependencies (Pinned Versions)

```json
{
  "dependencies": {
    "@effect/platform-bun": "4.0.0-beta.59",
    "effect": "4.0.0-beta.59"
  },
  "devDependencies": {
    "@effect/language-service": "0.75.1",
    "@types/bun": "1.2.16",
    "typescript": "5.8.3"
  }
}
```

> **Note:** In Effect 4.x beta monorepo, @effect/cli, @effect/platform, and @effect/printer are bundled within effect. They are imported as effect/unstable/cli, etc. effect-crdts is Phase E (not yet added).

> **Native dependency:** `libfff.dylib` is built from `.anakmagang/references/fff.nvim` crate `fff-c` via `rustPlatform.buildRustPackage` in the Nix flake. No npm package needed — loaded directly via `bun:ffi` using `Bun.dlopen()`.

### Research References (cloned in `.anakmagang/references/`)

| Repo | Path | Purpose |
|------|------|---------|
| front-depiction/Effect-CRDTs | `Effect-CRDTs/` | Pure Effect-TS CRDT library with file persistence |
| loro-dev/loro | `loro/` | Rich CRDT with WASM bindings (fallback option) |
| automerge/automerge | `automerge/` | Mature CRDT with WASM (fallback option) |
| fff.nvim | `fff.nvim/` | Native search engine — C FFI bindings for fuzzy find + grep |

---

## Command Tree

```
anakmagang
  +-- init
  |   +-- --preset <name>              # Init from bundled preset
  |   +-- --from <path>                # Init from custom config
  |   +-- --target <path>              # Target project directory
  |   +-- --force                      # Overwrite existing files
  +-- search
  |   +-- find <query>                 # Fuzzy file search via fff-c
  |   +-- grep <query>                 # Content search
  |   +-- multi-grep <patterns...>     # Multi-pattern Aho-Corasick search
  |   +-- find-dirs <query>            # Directory search
  |   +-- find-mixed <query>           # Mixed file/directory search
  +-- hook
  |   +-- list                         # List all guards from machine config
  |   +-- eval                         # Evaluate guards against stdin JSON
  |   +-- sync                         # Sync guards to .claude/settings.json
  +-- audit
  |   +-- agents [name]                # 9-phase agent audit
  |   +-- skills [name]                # 28-phase skill audit
  |   +-- all                          # Full audit sweep
  +-- memory
  |   +-- status                       # Memory system overview
  |   +-- create <name>                # Create memory node
  |   +-- query [--tag T] [--scale S] [--text Q]
  |   +-- promote <id>                 # Promote to higher scale
  |   +-- prune [--dry-run]            # Archive stale nodes
  |   +-- index                        # Scan .anakmagang/references, create nodes
  |   +-- resolve --query <Q>          # Fuzzy memory search
  +-- start <task>                     # Begin new orchestration session
  +-- next [answer] --session <id>     # Advance to next phase
  +-- observe <text> --session <id>    # Record observation
  +-- state [sessionId]                # Show session state (list all or detail one)
  +-- status                           # Machine/session state overview
  +-- update <key> <value> --session   # Add observation key:value
  +-- drop [sessionId]                 # Remove session (--force, --stale, --promote)
  +-- logs <sessionId>                 # Show raw event stream
  +-- --version / --help
```

---

## Project Structure

> File layout is provisional. Will be refined during implementation.

**Convention:** lowercase dot-separated = commands (`domain.sub.ts`), PascalCase = Effect services (`MemoryStore.ts`). Errors and schemas live in their owning module, not centralized.

```
apps/anakmagang/
  package.json
  tsconfig.json
  bun.lock
  src/
    bin.ts                       # Entry point — BunRuntime.runMain
    cli.ts                       # Root command + subcommand composition

    # --- Init ---
    init.ts                      # `anakmagang init` command
    MachineLoader.ts             # Service: load + reify .anakmagang/config.yaml presets

    # --- Search ---
    search.cmd.ts                # `anakmagang search` command group
    Search.ts                    # Service: fff-c native search via bun:ffi
    FFF.ts                       # FFI bindings for libfff-c

    # --- Hook ---
    hook.ts                      # `anakmagang hook` command group
    hook.list.ts                 # `hook list` — list guards from machine
    hook.eval.ts                 # `hook eval` — evaluate guard against stdin JSON
    hook.sync.ts                 # `hook sync` — sync guards to .claude/settings.json
    guard.ts                     # Guard type definitions and evaluation

    # --- Audit ---
    audit.ts                     # `anakmagang audit` command group
    audit.agents.ts              # `audit agents [name]` — 9-phase agent audit
    audit.skills.ts              # `audit skills [name]` — 28-phase skill audit
    audit.all.ts                 # `audit all` — run both audits
    ArchParser.ts                # Service: parse ARCHITECTURE.md domain->worker table
    AgentAuditor.ts              # Service: 9-phase agent definition audit
    SkillAuditor.ts              # Service: 28-phase skill file audit

    # --- Memory ---
    memory.ts                    # `anakmagang memory` command group
    memory.create.ts             # `memory create` — new memory node
    memory.query.ts              # `memory query` — search by tag/scale/content
    memory.promote.ts            # `memory promote` — promote to higher scale
    memory.prune.ts              # `memory prune` — archive stale nodes
    memory.status.ts             # `memory status` — memory system overview
    memory.index.ts              # `memory index` — scan .anakmagang/references, create nodes
    memory.resolve.ts            # `memory resolve` — fuzzy memory search
    MemoryStore.ts               # Service: CRUD + state transitions (ACTIVE->STALE->ARCHIVED)

    # --- Orchestration ---
    PhaseEngine.ts               # Service: orchestration phase engine
    EventLog.ts                  # Service: session event persistence
    Ulid.ts                      # Service: ULID generation
    start.cmd.ts                 # `anakmagang start` — begin orchestration session
    eval.cmd.ts                  # `anakmagang eval` — phase transitions, observations, artifacts
    state.cmd.ts                 # `anakmagang state` — show session state
    update.cmd.ts                # `anakmagang update` — add observation key:value
    drop.cmd.ts                  # `anakmagang drop` — remove session

    # --- Shared Services ---
    Config.ts                    # Service: repo root, CLAUDE.md, ARCHITECTURE.md paths
    Yaml.ts                      # Service: parse/write frontmatter via inline parser

    # --- Tests ---
    compare-fff.test.ts          # FFF comparison tests
```

~52 files, 0 directories

---

## Effect-TS Architecture

### Service Layer Design

Each subsystem defines services as Effect `Context.Tag` with `Layer` implementations. The root command composes all layers.

```typescript
// Pattern: every service follows this structure
import { Context, Effect, Layer } from "effect"

// Service interface + implementation co-located (Effect 4.x Context.Service pattern)
class Config extends Context.Service("Config")<Config>() {
  readonly repoRoot!: string
  readonly claudeMd!: Effect.Effect<string>
  readonly architectureMd!: Effect.Effect<string>
  readonly memoriesDir!: string
  readonly feedbackDir!: string

  static readonly Live = Layer.effect(
    Config,
    Effect.gen(function* () {
      const fs = yield* PlatformFs.FileSystem
      const repoRoot = yield* findRepoRoot()
      return new Config({
        repoRoot,
        claudeMd: fs.readFileString(`${repoRoot}/CLAUDE.md`),
        architectureMd: fs.readFileString(`${repoRoot}/ARCHITECTURE.md`),
        memoriesDir: `${repoRoot}/.claude/memories`,
        outDir: `${repoRoot}/.anakmagang/out`,
      })
    })
  )
}
```

### Command Pattern

```typescript
import { Command, Options, Args } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"

const auditAgents = Command.make(
  "agents",
  {
    name: Args.text({ name: "name" }).pipe(Args.optional),
    format: Options.text("format").pipe(
      Options.withAlias("f"),
      Options.withDefault("human"),
      Options.withDescription("Output format: human | json")
    ),
    verbose: Options.boolean("verbose").pipe(
      Options.withAlias("v"),
      Options.withDefault(false),
    ),
  },
  ({ name, format, verbose }) =>
    Effect.gen(function* () {
      const auditor = yield* AgentAuditor
      yield* auditor.audit(name)
    })
)
```

### Root Composition

```typescript
// src/cli.ts
const command = Command.make("anakmagang", {}, () =>
  Console.info("Anakmagang — R17{x} Universe CLI Tools")
).pipe(
  Command.withSubcommands([initCommand, hookCommand, searchCommand, auditCommand, memoryCommand])
)

// src/bin.ts
const cli = Command.run(command, {
  name: "Anakmagang CLI",
  version: "v0.1.0",
})

cli(process.argv).pipe(
  Effect.provide(BunServices.layer),
  BunRuntime.runMain
)
```

### Layer Composition

All layers are command-lazy. Each command provides its own required layers inline. There is no centralized layer tree or root-level eager provision — commands compose what they need:

```typescript
const auditAgentsHandler = Effect.gen(function* () {
  const auditor = yield* AgentAuditor
}).pipe(
  Effect.provide(AgentAuditor.Live),
  Effect.provide(ArchParser.Live),
  Effect.provide(Config.Live),
  Effect.provide(Yaml.Live),
)
```

### Error Model

Errors are co-located with the service that owns them — no centralized `errors.ts`.

```typescript
// In MemoryStore.ts
class MemoryNodeError extends Schema.TaggedError<MemoryNodeError>()(
  "MemoryNodeError",
  { id: Schema.String, message: Schema.String }
) {}

// In AgentAuditor.ts
class AuditFailure extends Schema.TaggedError<AuditFailure>()(
  "AuditFailure",
  { phase: Schema.Number, check: Schema.String, message: Schema.String, severity: Schema.Literal("warn", "fail") }
) {}
```

### Schema Validation

Schemas are co-located with their owning module:

```typescript
// Memory node schema — full fractal graph, lifecycle starts ACTIVE
const MemoryNode = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  type: Schema.Literal("user", "feedback", "project", "reference"),
  updated: Schema.String,
  id: Schema.String,
  scale: Schema.Literal("observation", "finding", "learning", "principle"),
  state: Schema.Literal("ACTIVE", "STALE", "ARCHIVED"),
  session_count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  edges: Schema.Struct({
    derived_from: Schema.Array(Schema.String),
  }),
  tags: Schema.Array(Schema.String),
})

const parseNode = Schema.decodeUnknown(MemoryNode, { errors: "all" })
```

### Component Architecture (Layer Map)

```
Layer 0 (external):     @effect/platform-bun, @effect/cli, effect 4.x, effect-crdts (ported), libfff.dylib (bun:ffi)
Layer 1 (shared):       Config, Yaml, Search
Layer 2 (domain):       MemoryStore,
                        ArchParser, AgentAuditor, SkillAuditor,
                        MachineLoader
Layer 3 (commands):     memory.*, audit.*, init, hook.* (~15 files)
Layer 4 (composition):  cli.ts, bin.ts
```

**Import rule:** Layer N imports from Layer N-1 and below. Never sideways or up.

---

## Subsystems

### Memory (Fractal Graph)

#### Unified Schema

All memory files live flat in `.claude/memories/`. State starts at **ACTIVE** — file existence implies creation. There is no CREATED state.

```yaml
---
id: "fin-delegate-foreground"
name: "Delegate Foreground"
description: "..."
type: project
scale: finding             # observation | finding | learning | principle
state: ACTIVE              # ACTIVE | STALE | ARCHIVED
updated: "2026-04-21"
session_count: 0
edges:
  derived_from: []
tags: ["delegation"]
---
```

#### Per-Type Stale Thresholds

Stale thresholds are configurable per node type in `.anakmagang/config.yaml`. Defaults:

```yaml
stale_thresholds:
  user: 10         # user preferences/context — longer lived
  feedback: 3      # session feedback patterns — refresh quickly
  project: 5       # project-specific knowledge — medium
  reference: 8     # external references — stable
```

These feed `SessionCountAbove N` guards in the memory machine. The `memory prune` command reads the configured thresholds from the active machine.

#### Node Lifecycle

Three states. **No CREATED state — lifecycle starts at ACTIVE.**

```
ACTIVE --(session_count > threshold)--> STALE --(prune)--> ARCHIVED
  |                                        |
  |<--(re-activated / accessed)------------+
  |
  +--(3+ convergences)--> PROMOTED (new node at higher scale)
                           (source nodes -> ARCHIVED)
```

- **ACTIVE**: Referenced, in use, content valid
- **STALE**: Untouched for N sessions (threshold varies by type). Needs re-validation.
- **ARCHIVED**: Superseded, invalid, or absorbed into higher-scale node. Kept for provenance.

Valid transitions:
- `ACTIVE -> STALE` — node not accessed for N sessions (per-type threshold)
- `STALE -> ARCHIVED` — node pruned after threshold
- `STALE -> ACTIVE` — node accessed again (re-activation)
- `ARCHIVED -> ACTIVE` — manual recovery via `memory promote`

#### Fractal Compression Scales

**Vertical axis** — self-similar structure at each scale:

| Scale | Contains | Lifespan |
|-------|----------|----------|
| Observation | Raw tool result, error, unexpected behavior | 1 session |
| Finding | Pattern from 3+ observations | 3-10 sessions |
| Learning | Distilled from 3+ findings | 10-50 sessions |
| Principle | Abstracted from 3+ learnings | Permanent (CLAUDE.md candidate) |

**Promotion** is coordinator judgment at Phase 16, not automated. Heuristic: "3+ similar items at lower scale suggest compression to next level." Principles are NEVER auto-applied to CLAUDE.md — self-anneal proposes, user approves.

#### Graph Relationships

**Horizontal axis** — `derived_from` edges between nodes:

| Edge Type | Constraint | Semantics |
|-----------|-----------|-----------|
| `derived_from` | DAG (acyclic) | "This was compressed/extracted from that" |

`derived_from` is the single edge type. The graph remains a strict DAG — no cycles permitted.

#### Search via fff-c

```typescript
class Search extends Context.Tag("Search")<Search, {
  readonly find: (query: string) => Effect.Effect<ReadonlyArray<SearchResult>, SearchError>
  readonly grep: (query: string, opts?: GrepOpts) => Effect.Effect<ReadonlyArray<GrepResult>, SearchError>
  readonly multiGrep: (patterns: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<GrepResult>, SearchError>
}>() {}
```

**fff-c functions used:**
- `fff_create_instance2` — init with ai_mode=true, content indexing, file watching
- `fff_search` — fuzzy file path search, frecency-ranked, paginated
- `fff_live_grep` — content search (plain/regex/fuzzy), smart_case, context lines
- `fff_multi_grep` — multi-pattern Aho-Corasick OR search
- `fff_destroy` / `fff_free_*` — cleanup

**Memory query flow:**
```
query --text Q  -> Search.grep(Q) over .claude/memories/ -> parse frontmatter -> filter by tag/scale/state
query --tag T   -> Search.multiGrep(["tags:", T]) -> parse results
query --scale S -> Search.grep("scale: S") -> filter
```

#### Operations and Budget

| Operation | Budget | Agent |
|-----------|--------|-------|
| Create memory | 1-2 calls | default worker |
| Query memory | 1-3 calls | coordinator (via Search service) |
| Promote node | 3 calls | default worker |
| Prune stale | 2-4 calls | default worker |

**Budget rule:** Graph ops use a soft sub-budget of ~8 calls. If remaining task budget < 12 at Phase 16, skip promotion — only create observations.

#### Key Service: MemoryStore

```typescript
interface MemoryStore {
  readonly create: (node: MemoryNodeInput) => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly read: (id: string) => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly update: (id: string, patch: Partial<MemoryNodeInput>) => Effect.Effect<MemoryNode, MemoryNodeError>
  readonly list: (filter?: MemoryFilter) => Effect.Effect<ReadonlyArray<MemoryNode>>
  readonly archive: (id: string) => Effect.Effect<void, MemoryNodeError>
  readonly transition: (id: string, to: "ACTIVE" | "STALE" | "ARCHIVED") => Effect.Effect<MemoryNode, MemoryNodeError>
}
```

#### Memory Failure Modes

| Failure | Severity | Prevention |
|---------|----------|------------|
| Graph cycles in derived_from | Catastrophic | DAG constraint — validate on write |
| Context overflow from traversal | Catastrophic | Hard caps: depth 2, fan-out 5, max 10 nodes |
| Concurrent write corruption | Catastrophic | Atomic temp+rename for memory file writes |
| Stale node poisoning | Recoverable | session_count + per-type state transitions |
| Orphan node accumulation | Recoverable | Edge-validity check during prune |
| Budget starvation | Recoverable | Soft sub-budget, yield to task ops |

---

### Audit (Supply Chain)

**Purpose:** Validate agent definitions and skill files against project conventions.

#### Agent Audit — 9 Phases

| # | Check | Implementation |
|---|-------|---------------|
| 1 | Frontmatter | Parse YAML, validate required fields via AgentFrontmatter schema |
| 2 | Tool Boundary | Compare tools list against CLAUDE.md Tool Restriction Boundary table |
| 3 | Delegation | Grep for "Agent" tool usage — workers must not delegate |
| 4 | Verification | Check for verification commands section in agent body |
| 5 | Completion Promises | Check for signal strings (IMPLEMENTATION_COMPLETE, etc.) |
| 6 | Skill References | Resolve referenced skills via glob in skills/ and skill-library/ |
| 7 | Size Check | Line count < 150 (Thin Agent Pattern) |
| 8 | Architecture Alignment | Match domain routing against ARCHITECTURE.md table |
| 9 | Output Format | Check for structured output format definition |

#### Skill Audit — 28 Checks (5 groups)

| Group | # | Check | Implementation |
|-------|---|-------|----------------|
| Structure | 1 | Frontmatter delimiters | frontmatter-exists |
| | 2 | Name field present | has-name |
| | 3 | Description field present | has-description |
| | 4 | File size within limits | size-check (≤500 pass, ≤800 warn, >800 fail) |
| | 5 | File location correctness | location (in .claude/skills/) |
| Content | 6 | Purpose statement clarity | purpose-statement (first paragraph >20 chars) |
| | 7 | Actionable content | actionable-content (code blocks or numbered/bulleted steps) |
| | 8 | Examples present | has-examples (multi-line code blocks) |
| | 9 | Constraints documented | has-constraints (DON'T/MUST NOT/NEVER/etc.) |
| | 10 | Consistent voice | consistent-voice (no mixed passive/imperative) |
| | 11 | Section structure | section-structure (## headers present) |
| | 12 | No placeholder text | no-placeholder (TODO/FIXME/TBD/XXX/HACK) |
| Integration | 13 | Gateway routing compatibility | gateway-compatible (nix/darwin + "When to use") |
| | 14 | Agent boundary safety | agent-boundary-safe (no Edit/Write + coordinator mix) |
| | 15 | Dependency existence | dependency-exists (referenced .claude/skills/*.md files exist) |
| | 16 | Cross-references valid | cross-references-valid (no absolute paths) |
| | 17 | Trigger conditions | trigger-conditions ("When to use" section) |
| | 18 | Output specification | output-specification (output/result/returns near code) |
| Quality | 19 | No redundancy | no-redundancy (no excessive CLAUDE.md duplication) |
| | 20 | Naming convention | naming-convention (/^[a-z][a-z0-9-]*$/) |
| | 21 | Date field present | has-updated-date (updated/created in frontmatter) |
| | 22 | Not deprecated | not-deprecated (deprecated field check) |
| | 23 | Sections complete | sections-complete (≥2 ## sections) |
| | 24 | Readability | readability (no lines >300 chars) |
| Security | 25 | No secrets | no-secrets (API key/password/token patterns) |
| | 26 | No absolute paths | no-absolute-paths (/Users/, /home/, C:\Users\) |
| | 27 | No unsafe commands | no-unsafe-commands (rm -rf, --force, git push -f, etc.) |
| | 28 | No injection vectors | no-injection-vectors (${} in shell blocks) |

#### Key Service: ArchParser

```typescript
interface ArchParser {
  readonly getDomainRouting: Effect.Effect<ReadonlyArray<DomainRoute>, ConfigNotFound>
  readonly getVerificationCommands: Effect.Effect<ReadonlyArray<string>, ConfigNotFound>
  readonly getConventions: Effect.Effect<ReadonlyArray<Convention>, ConfigNotFound>
}
```

#### Report Schema

```typescript
const AuditResult = Schema.Struct({
  phase: Schema.Number,
  check: Schema.String,
  status: Schema.Literal("pass", "warn", "fail"),
  message: Schema.String,
  file: Schema.String,
})

const AuditReport = Schema.Struct({
  target: Schema.String,
  type: Schema.Literal("agent", "skill"),
  results: Schema.Array(AuditResult),
  summary: Schema.Struct({
    passed: Schema.Number,
    warned: Schema.Number,
    failed: Schema.Number,
  }),
})
```

**Exit codes:** 0 (all pass), 1 (warnings only), 2 (failures).

---

## Implementation Phases

> **Status:** Phases A-D are complete (foundation, memory, audit). Phase F (state machine framework) is partially implemented — init, hook list/eval/sync, and search are done.

### Phase A: Foundation (4 files)

**Files:** Config.ts, Yaml.ts, Search.ts, FFF.ts

**Setup:**
```bash
mkdir -p apps/anakmagang/src
cd apps/anakmagang
bun init
bun add effect@4.0.0 @effect/cli@0.71.0 @effect/platform@0.92.0 @effect/platform-bun@0.81.0 @effect/printer@0.36.0
bun add -d @types/bun@1.3.0 typescript@5.9.0
```

**Acceptance:**
- Config discovers repo root via `git rev-parse --show-toplevel`
- Yaml round-trips: `stringify(parse(content)) === content`
- All unit tests pass with Effect TestContext (no real FS)
- Search service initializes fff-c instance via bun:ffi

**Verification:**
```bash
bun test src/Config.test.ts
bun test src/Yaml.test.ts
bun test src/Search.test.ts
```

**Stdio smoke test:**
```bash
bun run -e "
import { Command } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'

const test = Command.make('echo', 'hello')
  .pipe(Command.string, Effect.provide(BunContext.layer))

BunRuntime.runMain(test.pipe(Effect.tap(s => Effect.log(s))))
"
```

### Phase B: Memory Core (3 files)

**Files:** MemoryStore.ts, memory.status.ts, memory.ts

**Acceptance:**
- `MemoryStore.create` writes atomic (temp+rename) to `.claude/memories/`, state starts ACTIVE
- `MemoryStore.list` returns all memory files with parsed frontmatter
- `bun run src/bin.ts memory status` shows count and distribution

**Verification:**
```bash
bun test src/MemoryStore.test.ts
bun run src/bin.ts memory status
```

### Phase C: Memory Commands + Audit Foundation (5 files)

**Files:** memory.create.ts, memory.query.ts, memory.promote.ts, memory.prune.ts, ArchParser.ts

**Acceptance:**
- `memory create --type project --name "test"` creates a file with valid frontmatter, state ACTIVE
- `memory query --tag delegation` returns matching nodes
- `memory promote` transitions node to higher scale with derived_from edge
- `memory prune` identifies and transitions stale nodes (using per-type thresholds)
- `ArchParser` parses ARCHITECTURE.md and extracts domain->worker routing table

**Verification:**
```bash
bun test src/ArchParser.test.ts
bun run src/bin.ts memory create --type project --name "test-node" --description "test"
bun run src/bin.ts memory query --tag test
```

### Phase D: Audit (6 files)

**Files:** AgentAuditor.ts, SkillAuditor.ts, audit.agents.ts, audit.skills.ts, audit.all.ts, audit.ts

**Acceptance:**
- `audit agents` runs 9 phases against every `.claude/agents/*.md` file
- `audit skills` runs 28 phases against every `.claude/skills/*.md` file
- Phase 1 failure gates phases 2-9/2-28
- `--format json` produces valid JSON with pass/warn/fail per phase
- Exit code: 0 (all pass), 1 (warnings), 2 (failures)

**Verification:**
```bash
bun test src/AgentAuditor.test.ts
bun test src/SkillAuditor.test.ts
bun run src/bin.ts audit agents
bun run src/bin.ts audit skills
bun run src/bin.ts audit all --format json
echo $?
```

### Phase F: State Machine Framework (init, hook)

**Files:** init.ts, MachineLoader.ts, hook.ts, hook.list.ts, hook.eval.ts

**Acceptance:**
- `anakmagang init --preset orchestrate` generates all artifacts from the bundled preset
- `anakmagang init --from ./.anakmagang/config.yaml` loads and reifies a custom definition
- `anakmagang hook list` projects guards from the loaded machine
- `anakmagang hook <id>` evaluates a guard — callable from settings.json hooks
- Init is idempotent: re-running merges without destructive overwrites

**Verification:**
```bash
bun test src/MachineLoader.test.ts
bun run src/bin.ts init --preset minimal --target /tmp/test-project
ls /tmp/test-project/.claude/skills/
bun run src/bin.ts hook list
```

### Parallel Task: Port effect-crdts to Effect 4.x

**Source:** `.anakmagang/references/Effect-CRDTs/`
**Scope:** ~2k LOC, primarily STM and Schema API updates
**Output:** `apps/anakmagang/src/crdt/` or published fork

**Key changes expected:**
- Update `peerDependencies` from Effect 3.x to 4.x
- Update STM API calls if changed between versions
- Update Schema API calls (Schema.Class, Schema.TaggedError)
- Run existing 179 property-based tests against Effect 4.x

---

## Requirements

### Functional Requirements

**FR-MEM: Memory Subsystem**

| ID | Requirement | Priority | Success Metric |
|----|------------|----------|---------------|
| FR-MEM-1 | Create memory node with YAML frontmatter; lifecycle starts ACTIVE | P0 | File created in `.claude/memories/` with state: ACTIVE |
| FR-MEM-2 | Query memories by tag, content, or name | P0 | Returns matching nodes in <500ms for <50 files |
| FR-MEM-3 | Show memory system status (count, distribution) | P0 | Accurate count matches `ls .claude/memories/ \| wc -l` |
| FR-MEM-4 | Promote node to higher scale | P1 | Node transitions to next scale with derived_from edge |
| FR-MEM-5 | Prune stale nodes using per-type thresholds | P1 | Nodes with session_count > type-threshold transition to STALE/ARCHIVED |

**FR-AUD: Audit Subsystem**

| ID | Requirement | Priority | Success Metric |
|----|------------|----------|---------------|
| FR-AUD-1 | 9-phase agent definition audit | P0 | All 9 phases execute; report shows pass/warn/fail per phase |
| FR-AUD-2 | 28-phase skill file audit | P0 | All 28 phases execute in 5 groups |
| FR-AUD-3 | Audit all agents and skills in one command | P0 | `audit all` covers every file in `.claude/agents/` and `.claude/skills/` |
| FR-AUD-4 | Phase 1 failure gates subsequent phases | P0 | If frontmatter invalid, phases 2-9 skipped with annotation |
| FR-AUD-5 | Human and JSON output formats | P0 | `--format json` produces valid JSON; default is human-readable |
| FR-AUD-6 | Exit codes: 0=pass, 1=warnings, 2=failures | P0 | Verified via `echo $?` after invocation |

**FR-INIT: Init & Hook Subsystem**

| ID | Requirement | Priority | Success Metric |
|----|------------|----------|---------------|
| FR-INIT-1 | Generate orchestration harness from preset | P1 | `anakmagang init --preset X` produces all artifacts |
| FR-INIT-2 | Init is idempotent | P1 | Re-running merges without destructive overwrites |
| FR-INIT-3 | Hook evaluation callable from settings.json | P1 | `anakmagang hook <id>` returns Allow/Block/Warn |
| FR-INIT-4 | List machine guards | P1 | `anakmagang hook list` shows all guards with descriptions |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|------------|--------|
| NFR-1 | CLI startup time | <200ms for `--help` |
| NFR-2 | Memory query latency | <500ms for <50 files |
| NFR-3 | Audit execution time | <2s per target file (all phases) |
| NFR-4 | Zero npm runtime dependencies beyond Effect ecosystem | Native dep: libfff.dylib via bun:ffi |
| NFR-5 | Typed errors for all failure modes | Every error channel is a TaggedError, never `unknown` |
| NFR-6 | Testable without real FS | Effect TestContext mocks for all services |

---

## Failure Modes

### Catastrophic Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Stale memory poisoning | HIGH | per-type session_count thresholds + state transitions from day one. Prune command enforces lifecycle. |
| CRDT file corruption | MEDIUM | Atomic writes (temp+rename). Backup on parse failure. Rebuildable from source files. |
| ARCHITECTURE.md parse failure | MEDIUM | Validate parsed output against DomainRoute schema. Fail loudly on zero routes. |
| Graph cycles in derived_from | Catastrophic | DAG constraint — validate on write |
| Context overflow from graph traversal | Catastrophic | Hard caps: depth 2, fan-out 5, max 10 nodes |
| Concurrent write corruption | Catastrophic | Atomic temp+rename for memory file writes |

### State Machine Cascade Points

| System | Cascade Point | Impact |
|--------|--------------|--------|
| CLI Lifecycle | PROVIDE_LAYERS root failure | All subsystems fail. Mitigated by lazy per-command provision. |
| Audit Pipeline | ArchParser failure | Phase 8 fails for all targets. Other phases unaffected. |
| Memory CRUD | Concurrent writes | Atomic temp+rename for file writes. CRDT for schema registry. |
| Session Integration | Manifest corruption | All phase tracking lost. Backup+reinitialize on parse failure. |

---

## Anti-Patterns

- **DO NOT** position anakmagang as a replacement for CLAUDE.md — it enforces what CLAUDE.md declares
- **DO NOT** build features for hypothetical users — R17 and Claude are the only confirmed users
- **DO NOT** use external validation libraries — `effect/Schema` handles everything
- **DO NOT** add HTTP server capabilities — this is a CLI tool, not a service
- **DO NOT** use `console.log` — use `Effect.log` / `Console.info`
- **DO NOT** use `process.exit` — let Effect runtime handle exit codes via error channel
- **DO NOT** add abstractions for single-use operations — three lines > premature helper
- **DO NOT** automate memory promotion — coordinator judgment only, never a counter trigger
- **DO NOT** auto-apply principles to CLAUDE.md — self-anneal proposes, user approves
- **DO NOT** add edge types beyond `derived_from` — keep the graph simple until proven insufficient
- **DO NOT** spend >8 tool calls on memory ops in a single task
- **DO NOT** classify agonize — if unsure whether something is finding or learning, make it a finding (promote later)
- **DO NOT** store ephemeral task state as memory — that's the manifest's job
- **DO NOT** create a service for something that can be a pure function
- **DO NOT** import from a higher layer — dependency inversion via Effect Tags instead
- **DO NOT** put domain logic in command files — commands are thin wrappers that call services
- **DO NOT** share error types across services — each service owns its errors
- **DO NOT** create `index.ts` barrel files — import directly from source files
- **DO NOT** implement phases out of order — dependencies are real
- **DO NOT** skip verification after each phase — bugs compound

---

## Open Questions

1. **Native lib delivery**: Should `libfff.dylib` be built inline via Nix or consumed from fff.nvim's flake output?
2. **Machine extension**: Should `extends` be a pullback in the category of presets? (e.g., `extends: minimal` adds phases to a base machine)
3. **Guard evaluation order**: Guards are a list — is it conjunction (all must pass) or should we support disjunction?
4. **Action atomicity**: Are actions within a single transition atomic? If one fails, do we roll back?
5. **Hot reload**: If the preset YAML changes, can the running machine adapt without restart?
6. **Machine definition format**: Resolved — YAML at `.anakmagang/config.yaml` (generated by `anakmagang init`, not created manually). YAML is more portable for OSS.
7. **Init idempotency strategy**: Merge vs overwrite generated files?
8. **Hook generation**: Shell scripts (portable) or Effect-TS hooks (typed but requires Bun)?
9. **Preset distribution**: Bundled in the binary, or fetched from a registry/repo?

---

## Decision Record

| Date | Decision | Choice | Rationale |
|------|----------|--------|-----------|
| 2026-04-20 | Original designs | Audit tooling, fractal memory as separate subsystems | Initial exploration |
| 2026-04-21 | Memory design | Via Principal Thinking protocol + R1/R2 review | Structured design process |
| 2026-04-24 | CLI unification | Single `anakmagang` CLI with Effect-TS + Bun | Shared infra, single install |
| 2026-04-24 | CLI name | `anakmagang` | Indonesian for 'intern/apprentice' |
| 2026-04-24 | Location | `apps/anakmagang/` | Alongside other apps in the repo |
| 2026-04-24 | Effect version | 4.x | Typed errors, services, structured concurrency |
| 2026-04-24 | Validation | `effect/Schema` | Native, zero extra deps |
| 2026-04-24 | Audit scope | Full 9-phase agent + 28-phase skill | Complete audit engine; user decision (R2 overridden) |
| 2026-04-24 | CRDT | Port `effect-crdts` to Effect 4.x | Concurrent-safe schema persistence; user decision (R2 overridden) |
| 2026-04-27 | Memory schema | Single unified schema | Full fractal graph from day one |
| 2026-04-27 | Search engine | fff-c via bun:ffi | Native performance, no npm wrapper |
| 2026-04-27 | Coupling topology | DAG — Orchestration is the hub | Subsystems signal back via `BackEvent` only. No cross-subsystem couplings. |
| 2026-04-27 | Layer provision | All command-lazy — each command provides its own layers | Isolate failure domains per subsystem |
| 2026-04-27 | File writes | Atomic temp+rename (inline, 3 lines) | No helper needed; prevents partial writes |
| 2026-05-03 | Doc hierarchy | Merge all into `anakmagang.md` | Single source of truth |
| 2026-05-03 | `init` command | In scope now — Phase F | First-class command in command tree |
| 2026-05-03 | CRDT | Hard requirement for concurrent safety | Not optional — concurrent safety is a core constraint |
| 2026-05-03 | CREATED state | REMOVED | File existence = created; lifecycle starts at ACTIVE |
| 2026-05-03 | Stale threshold | Configurable per-node type | user: 10, feedback: 3, project: 5, reference: 8 (defaults) |

---

## Confidence Assessment

| Phase | Confidence |
|-------|-----------|
| 1. Context Excavation | 0.84 |
| 2. Constraint Mapping | 0.88 |
| 3. Failure Mode Analysis | 0.80 |
| 4. Solution Architecture | 0.84 |
| R1 (Principal Engineer) | 7/10 |
| R2 (Devil's Advocate) | 4/10 |
| **Overall** | **0.72** |

### Key Caveats

1. **effect-crdts port to Effect 4.x** — Uncharted territory. The library is small (~2k LOC) but depends on Effect 3.x STM and Schema APIs that may have changed. Fallback: plain JSON persistence if port proves too costly. (CRDT is a hard requirement — fallback must still provide concurrent safety.)
2. **28-phase skill audit** — Comprehensive but untested against real skills. May produce false positives that erode trust.
3. **Flat structure** — ~34 files now. Works now; monitor for cognitive load as features grow. If it becomes a wall, add 3 shallow dirs.
4. **Promotion threshold (3+)** — Arbitrary threshold, needs empirical tuning. Confidence: 0.60.

### R1 Recommendations (Status)

1. ~~Resolve CRDT contradiction~~ Resolved: port effect-crdts to Effect 4.x (hard requirement)
2. ~~Move Bun stdio validation to Phase A~~ Accepted: smoke test in Phase A
3. ~~Specify memory version detection~~ Resolved: unified schema, no versions to detect

### R2 Issues (User Overrode)

| Issue | R2 Score | User Decision |
|-------|---------|--------------|
| effect-crdts/Effect 4.x incompatibility | 2/10 | Port it (hard requirement) |
| 34 flat files vs 15+dirs | 3/10 | Keep flat |
| 28-phase audit overkill | 2/10 | Build it all |
| Unification questioned | 4/10 | Keep unified |

These were informed, deliberate choices. The user accepts the risk profile.

---

## Nix Integration

The CLI lives in `apps/anakmagang/` and is available via Bun:

```bash
# Direct execution
bun run apps/anakmagang/src/bin.ts

# Via Nix dev shell (bun is already available)
nix develop .#bun -c bun run apps/anakmagang/src/bin.ts

# Or add a shell alias in nix/modules/cross/ or Fish config
alias anakmagang="bun run $NIXPKGS_DIR/apps/anakmagang/src/bin.ts"
```

**Native library:** `libfff.dylib` must be built and available at runtime:
- Built as a Nix derivation from the `fff.nvim` flake (`fff-c` crate via `rustPlatform.buildRustPackage`)
- Pointed at an existing installation via `LIBFFF_PATH` environment variable

Future: package as a Nix derivation via `pkgs-by-name` pattern if the tool stabilizes.

## Testing Strategy

```bash
# Unit tests (Effect TestContext — no real FS)
bun test src/**/*.test.ts

# Integration tests (real files in a temp dir)
bun test src/**/*.integration.test.ts

# Smoke test
bun run src/bin.ts --help
bun run src/bin.ts audit agents
bun run src/bin.ts memory status
```

Effect's `TestContext` provides mock FileSystem/Process layers, making unit tests deterministic without touching the real filesystem.
