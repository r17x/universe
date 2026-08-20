import * as Schema from "effect/Schema";

const GuardRuleConfig = Schema.Struct({
  contains: Schema.Array(Schema.String),
  should: Schema.String,
  unless_contains: Schema.optional(Schema.String),
});

const VerificationRuleConfig = Schema.Struct({
  file_pattern: Schema.String,
  required_commands: Schema.Array(Schema.String),
  message: Schema.String,
});

export const GuardConfigSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.optional(Schema.String),
  enforced_by: Schema.optional(Schema.String),
  event: Schema.optional(Schema.String),
  matcher: Schema.optional(Schema.String),
  timeout: Schema.optional(Schema.Number),
  max: Schema.optional(Schema.Number),
  warn_at: Schema.optional(Schema.Number),
  rules: Schema.optional(Schema.Array(GuardRuleConfig)),
  enabled: Schema.optional(Schema.Boolean),
  command: Schema.optional(Schema.String),
  skill: Schema.optional(Schema.String),
  promises: Schema.optional(Schema.Array(Schema.String)),
  verification_rules: Schema.optional(Schema.Array(VerificationRuleConfig)),
  restricted_paths: Schema.optional(Schema.Array(Schema.String)),
  restricted_prefixes: Schema.optional(Schema.Array(Schema.String)),
  file_pattern: Schema.optional(Schema.String),
  routes: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  reminders: Schema.optional(Schema.Array(Schema.String)),
});

export type GuardConfig = typeof GuardConfigSchema.Type;

export const matchesTool = (matcher: string | undefined, toolName: string | undefined): boolean => {
  if (matcher === undefined || matcher === "") return true;
  if (toolName === undefined) return false;
  const patterns = matcher.split("|");
  return patterns.some((p) => toolName.includes(p));
};

export const hashString = (s: string): string => Bun.hash(s).toString(36);

export const ContextWindow = Schema.Struct({
  used_percentage: Schema.optional(Schema.NullOr(Schema.Number)),
  input_tokens: Schema.optional(Schema.NullOr(Schema.Number)),
  output_tokens: Schema.optional(Schema.NullOr(Schema.Number)),
  cache_creation_input_tokens: Schema.optional(Schema.NullOr(Schema.Number)),
  cache_read_input_tokens: Schema.optional(Schema.NullOr(Schema.Number)),
  context_window_size: Schema.optional(Schema.NullOr(Schema.Number)),
});

export const computeContextPct = (
  cw: typeof ContextWindow.Type | undefined,
): number | undefined => {
  if (!cw) return undefined;
  const size = cw.context_window_size;
  if (typeof size !== "number" || size <= 0)
    return typeof cw.used_percentage === "number" ? cw.used_percentage : undefined;
  const input = typeof cw.input_tokens === "number" ? cw.input_tokens : 0;
  const output = typeof cw.output_tokens === "number" ? cw.output_tokens : 0;
  const cacheCreation =
    typeof cw.cache_creation_input_tokens === "number" ? cw.cache_creation_input_tokens : 0;
  const cacheRead = typeof cw.cache_read_input_tokens === "number" ? cw.cache_read_input_tokens : 0;
  const total = input + output + cacheCreation + cacheRead;
  return total > 0
    ? (total / size) * 100
    : typeof cw.used_percentage === "number"
      ? cw.used_percentage
      : undefined;
};

export const BridgeData = Schema.Struct({
  context_window: Schema.optional(ContextWindow),
  transcript_path: Schema.optional(Schema.String),
  last_seen: Schema.optional(Schema.String),
  current_task: Schema.optional(Schema.String),
  current_phase: Schema.optional(Schema.String),
});
