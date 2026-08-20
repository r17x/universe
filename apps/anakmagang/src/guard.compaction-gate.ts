import { Array as Arr } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Allow, Block, Warn } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

export const compactionGate: GuardFn = (ctx) =>
  Effect.sync(() => {
    if (!ctx.current || (Option.isNone(ctx.current.contextPct) && !ctx.current.active))
      return Allow();

    if (Option.isNone(ctx.current.contextPct))
      return Warn({
        message:
          "Context usage unknown — context_window.used_percentage not provided by client. Guard cannot enforce compaction threshold.",
      });

    const pct = ctx.current.contextPct.value;
    const sessionId = ctx.current.sessionId;

    const thresholds = [
      {
        trigger: 75,
        result: Block,
        prefix: "BLOCKED: Context at",
        onSome: (sid: string) =>
          ` Teleport now → new terminal, then: anakmagang eval "<reflection>" --session ${sid}`,
        onNone: () => ` Context window critically full. Start a new conversation to continue.`,
      },
      {
        trigger: 60,
        result: Warn,
        prefix: "⚠ Context at",
        onSome: (sid: string) =>
          ` Prepare to teleport → new terminal, continue with: anakmagang eval "<reflection>" --session ${sid}`,
        onNone: () => ` Context window filling up. Consider starting a new conversation soon.`,
      },
    ] as const;

    return Arr.findFirst(thresholds, (t) => pct > t.trigger).pipe(
      Option.match({
        onNone: () => Allow(),
        onSome: (t) => {
          const teleport = sessionId.pipe(Option.match({ onNone: t.onNone, onSome: t.onSome }));
          return t.result({ message: `${t.prefix} ${Math.round(pct)}%.${teleport}` });
        },
      }),
    );
  });
