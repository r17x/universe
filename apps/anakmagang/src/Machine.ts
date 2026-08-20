/**
 * @module Machine
 *
 * Pure type definitions for the anakmagang state machine.
 *
 * Part of: Core type system — the foundation every other module builds on.
 * This module defines Machine s e g a (states, events, guards, actions),
 * the Preset serialization format, and the Ground/Store algebra.
 *
 * Depends on: effect (Schema)
 *
 * Key types:
 *   - MachineConfig: the top-level machine schema (Preset in the formal model)
 *   - Store: closed union (Slot | Memory | Artifact)
 *   - Ground: stores + flows + statusline (the concrete world)
 *   - Phase, Transition, Guard: the dynamics (s, e, g)
 *   - Runtime: internal config consumed only by anakmagang
 */

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { GuardConfigSchema } from "./protocol.GuardConfig";

export { GuardConfigSchema } from "./protocol.GuardConfig";

export const OnAdvanceCommand = Schema.Struct({
  command: Schema.String,
  file_pattern: Schema.optional(Schema.String),
});

export const PhaseConfig = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  exit_question: Schema.String,
  next: Schema.NullOr(Schema.String),
  actions: Schema.optional(Schema.Array(Schema.String)),
  skip_when: Schema.optional(Schema.Array(Schema.String)),
  on_advance: Schema.optional(Schema.Array(OnAdvanceCommand)),
  on_rollback: Schema.optional(Schema.Array(Schema.String)),
});

export const TransitionConfig = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  when: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
});

export const SizePresetConfig = Schema.Struct({
  phases: Schema.optional(Schema.Array(Schema.String)),
  skip: Schema.optional(Schema.Array(Schema.String)),
  criteria: Schema.optional(Schema.Array(Schema.String)),
});

export const FieldMode = Schema.Literals(["set", "append", "merge", "incr"]);

export const GranularityConfig = Schema.Literals(["singleton", "session"]);

export const SlotStore = Schema.Struct({
  kind: Schema.Literal("Slot"),
  name: Schema.String,
  per: GranularityConfig,
  tracks: Schema.Record(Schema.String, FieldMode),
});

export const MemoryStoreEntry = Schema.Struct({
  kind: Schema.Literal("Memory"),
  name: Schema.String,
  path: Schema.String,
  budget: Schema.Number,
});

export const ArtifactStore = Schema.Struct({
  kind: Schema.Literal("Artifact"),
  name: Schema.String,
  path: Schema.String,
  writable: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
});

export const DomainRouteConfig = Schema.Struct({
  domain: Schema.String,
  patterns: Schema.Array(Schema.String),
  worker: Schema.String,
});

export const ProviderConfig = Schema.Struct({
  id: Schema.String,
  directory: Schema.String,
  memories_dir: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("memories"))),
  skills_dir: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("skills"))),
  agents_dir: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("agents"))),
  settings_file: Schema.optional(Schema.String),
  hooks_file: Schema.optional(Schema.String),
  env_vars: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

export const Store = Schema.Union([SlotStore, MemoryStoreEntry, ArtifactStore]);

export const FlowConfig = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  trigger: Schema.Union([Schema.Literal("manual"), Schema.Literal("on_stale"), Schema.String]),
  description: Schema.optional(Schema.String),
});

export const PromotionConfig = Schema.Struct({
  min_sources: Schema.Number,
  auto: Schema.Boolean,
});

export const GraphConfig = Schema.Struct({
  edge_types: Schema.Array(Schema.String),
  max_depth: Schema.Number,
  max_fan_out: Schema.Number,
  max_query_nodes: Schema.Number,
});

export const RuntimeMemoryConfig = Schema.Struct({
  scales: Schema.Array(Schema.String),
  states: Schema.Array(Schema.String),
  stale_thresholds: Schema.Record(Schema.String, Schema.Number),
  promotion: PromotionConfig,
  graph: GraphConfig,
});

export const RuntimeConfig = Schema.Struct({
  memory: RuntimeMemoryConfig,
});

export const StatuslineThresholds = Schema.Tuple([Schema.Number, Schema.Number]);

export const StatuslineSegmentConfig = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  format: Schema.optional(Schema.String),
  render: Schema.optional(Schema.Literals(["text", "bar", "duration"])),
  display: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number),
  thresholds: Schema.optional(StatuslineThresholds),
  cache: Schema.optional(Schema.Number),
});

export const StatuslineLayoutLine = Schema.Array(Schema.String);

export const StatuslineConfig = Schema.Struct({
  segments: Schema.optional(Schema.Array(StatuslineSegmentConfig)),
  layout: Schema.optional(Schema.Array(StatuslineLayoutLine)),
  separator: Schema.optional(Schema.String),
  presets: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.Array(Schema.String), Schema.Literal("all")]),
    ),
  ),
  active: Schema.optional(Schema.String),
  refresh_interval: Schema.optional(Schema.Number),
});

export type StatuslineConfigType = typeof StatuslineConfig.Type;

export const GroundConfig = Schema.Struct({
  stores: Schema.Array(Store),
  flows: Schema.optional(Schema.Array(FlowConfig)),
  routing: Schema.optional(Schema.Array(DomainRouteConfig)),
  statusline: Schema.optional(StatuslineConfig),
  providers: Schema.optional(Schema.Array(ProviderConfig)),
});

export const ExperimentalCapability = Schema.Struct({
  id: Schema.String,
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  description: Schema.optional(Schema.String),
  prompt: Schema.String,
});

export const MachineConfig = Schema.Struct({
  name: Schema.String,
  version: Schema.Number,
  ground: GroundConfig,
  runtime: RuntimeConfig,
  phases: Schema.Array(PhaseConfig),
  transitions: Schema.optional(Schema.Array(TransitionConfig)),
  guards: Schema.optional(Schema.Array(GuardConfigSchema)),
  size_presets: Schema.optional(Schema.Record(Schema.String, SizePresetConfig)),
  experimental: Schema.optional(Schema.Array(ExperimentalCapability)),
  rules: Schema.optional(Schema.Array(Schema.String)),
  directives: Schema.optional(Schema.Array(Schema.String)),
});

export type Phase = typeof PhaseConfig.Type;
export type Transition = typeof TransitionConfig.Type;
export type StoreEntry = typeof Store.Type;
export type SlotStoreType = typeof SlotStore.Type;
export type DomainRoute = typeof DomainRouteConfig.Type;
export type MemoryStoreType = typeof MemoryStoreEntry.Type;
export type ArtifactStoreType = typeof ArtifactStore.Type;
export type Flow = typeof FlowConfig.Type;
export type Ground = typeof GroundConfig.Type;
export type SizePreset = typeof SizePresetConfig.Type;
export type ExperimentalCapabilityType = typeof ExperimentalCapability.Type;
export type Machine = typeof MachineConfig.Type;
export type ProviderConfigType = typeof ProviderConfig.Type;
