import * as Data from "effect/Data";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { GuardConfig } from "./protocol.GuardConfig";
import { ContextWindow } from "./protocol.GuardConfig";

export const HookInputSchema = Schema.Struct({
  tool_name: Schema.optional(Schema.String),
  tool_input: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  session_id: Schema.optional(Schema.String),
  transcript_path: Schema.optional(Schema.String),
  output: Schema.optional(Schema.String),
  transcript: Schema.optional(Schema.String),
  result: Schema.optional(Schema.String),
  tool_result: Schema.optional(
    Schema.Struct({
      text: Schema.optional(Schema.String),
    }),
  ),
  agent_id: Schema.optional(Schema.String),
  context_window: Schema.optional(ContextWindow),
});

export type HookInput = typeof HookInputSchema.Type;

export interface HookEnv {
  readonly CLAUDE_PROJECT_DIR: string;
  readonly CLAUDE_AGENT_NAME?: string;
}

export interface CurrentData {
  readonly sessionId: Option.Option<string>;
  readonly task: Option.Option<string>;
  readonly phase: Option.Option<string>;
  readonly active: boolean;
  readonly draft: boolean;
  readonly contextPct: Option.Option<number>;
  readonly iterationCount: number;
  readonly configStores: ReadonlyArray<{ readonly path: string; readonly writable: boolean }>;
}

export const emptyCurrentData: CurrentData = {
  sessionId: Option.none(),
  task: Option.none(),
  phase: Option.none(),
  active: false,
  draft: false,
  contextPct: Option.none(),
  iterationCount: 0,
  configStores: [],
};

export interface GuardContext {
  readonly input: HookInput;
  readonly env: HookEnv;
  readonly guard: GuardConfig;
  readonly current?: CurrentData;
}

export type GuardInput = Omit<GuardContext, "current">;

export type GuardResult = Data.TaggedEnum<{
  Allow: {};
  Info: { readonly message: string };
  Warn: { readonly message: string };
  Block: { readonly message: string };
}>;

export const { Allow, Info, Warn, Block, $is, $match } = Data.taggedEnum<GuardResult>();
