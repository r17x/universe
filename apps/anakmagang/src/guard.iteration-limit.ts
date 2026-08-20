import * as Effect from "effect/Effect";
import { Allow, Block, Warn } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

const checkThreshold = (count: number, max: number, warnAt: number, agent: string) =>
  count >= max
    ? Block({
        message: `BLOCKED: Iteration limit reached for ${agent} (${count}/${max}). Escalate to user.`,
      })
    : count >= warnAt
      ? Warn({ message: `WARNING: ${agent} at ${count}/${max} tool calls used.` })
      : Allow();

export const iterationLimit: GuardFn = (ctx) =>
  Effect.sync(() => {
    const agentName = ctx.env.CLAUDE_AGENT_NAME;
    if (!agentName?.trim()) return Allow();

    const max = ctx.guard.max ?? 200;
    const warnAt = ctx.guard.warn_at ?? 40;

    const next = (ctx.current?.iterationCount ?? 0) + 1;
    return checkThreshold(next, max, warnAt, agentName);
  });
