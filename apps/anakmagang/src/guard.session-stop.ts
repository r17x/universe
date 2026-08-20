import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Allow, Info } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

export const sessionStopGuard: GuardFn = (ctx) =>
  Effect.sync(() => {
    if (ctx.input.agent_id) return Allow();
    if (!ctx.current || Option.isNone(ctx.current.sessionId)) return Allow();
    if (!ctx.current.active) return Allow();
    if (ctx.current.draft) return Allow();

    const task = Option.getOrElse(ctx.current.task, () => "unknown");
    const phase = Option.getOrElse(ctx.current.phase, () => "unknown");

    return Info({
      message: `Cannot end session with incomplete task.\nTask: ${task}\nPhase: ${phase}`,
    });
  });
