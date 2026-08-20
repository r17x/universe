import { Data } from "effect";
import type { MemoryNode } from "./MemoryParser";
import type { SessionId } from "./Ulid";

export type PhaseInfo = Data.TaggedEnum<{
  PhaseInfo: {
    readonly id: string;
    readonly name: string;
    readonly number: number;
  };
}>;

const _PhaseInfo = Data.taggedEnum<PhaseInfo>();
export const PhaseInfo = _PhaseInfo.PhaseInfo;

export type EvalResult = Data.TaggedEnum<{
  Advanced: {
    readonly sessionId: SessionId;
    readonly rule: string;
    readonly from: PhaseInfo;
    readonly to: PhaseInfo;
    readonly question: string;
    readonly actions?: readonly string[];
  };
  LoopedBack: {
    readonly sessionId: SessionId;
    readonly rule: string;
    readonly from: PhaseInfo;
    readonly to: PhaseInfo;
    readonly question: string;
    readonly reason: string;
  };
  Completed: {
    readonly sessionId: SessionId;
    readonly rule: string;
    readonly from: PhaseInfo;
    readonly actions: readonly string[];
  };
  Blocked: {
    readonly sessionId: SessionId;
    readonly guard: string;
    readonly message: string;
    readonly from: PhaseInfo;
  };
}>;

const _EvalResult = Data.taggedEnum<EvalResult>();
export const Advanced = _EvalResult.Advanced;
export const LoopedBack = _EvalResult.LoopedBack;
export const Completed = _EvalResult.Completed;
export const Blocked = _EvalResult.Blocked;
export const $is = _EvalResult.$is;
export const $match = _EvalResult.$match;

export type TaskSize = "TRIVIAL" | "SMALL" | "MEDIUM" | "LARGE";

export interface EvalInput {
  readonly reflection: string;
  readonly sessionId: SessionId;
  readonly size?: string;
  readonly confidence?: "low";
}

export interface StartResult {
  readonly sessionId: SessionId;
  readonly phase: PhaseInfo;
  readonly question: string;
  readonly totalPhases: number;
  readonly memories: readonly MemoryNode[];
}
