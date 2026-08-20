import { Array as Arr, Effect, Option } from "effect";
import type { SessionId } from "./Ulid";
import { Config } from "./Config";
import { EventLog } from "./EventLog";
import { MemoryStore } from "./MemoryStore";
import { ExperimentalFeatures } from "./ExperimentalFeatures";
import type { MemoryNode } from "./MemoryParser";
import { scaleOrder } from "./MemoryParser";
import { Warn } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

const FAILURE_KEYWORDS = ["fail", "error", "blocked", "broke", "wrong", "misinterpret"] as const;

const ANNEAL_SUGGESTION =
  "⚡ Recurring patterns detected in recent sessions. Consider running /self-anneal to analyze and propose fixes.";

const BASE_WARNING =
  "\u26a0\ufe0f MANDATORY: Run /orchestrate before starting any task. No active orchestration session found. Do NOT explore, plan, or delegate until /orchestrate has been run.";

const makeWarning = (annealSuggestion: string | undefined): string =>
  annealSuggestion ? `${BASE_WARNING}\n${annealSuggestion}` : BASE_WARNING;

const extractKeywords = (task: string): readonly string[] => {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "that",
    "this",
    "will",
    "can",
    "not",
    "but",
    "has",
    "have",
    "was",
    "are",
    "been",
    "none",
  ]);
  const keywords = Arr.filter(
    Arr.map(task.split(/\s+/), (w) => w.toLowerCase().replace(/[^a-z0-9-]/g, "")),
    (w) => w.length > 2 && !stopWords.has(w),
  );
  return keywords.length > 0 ? keywords : [];
};

const checkAnnealSuggestion: Effect.Effect<string | undefined, never, EventLog> = Effect.gen(
  function* () {
    const eventLog = yield* EventLog;
    const sessions = yield* eventLog
      .listSessions()
      .pipe(Effect.orElseSucceed((): SessionId[] => []));
    const results = yield* Effect.forEach(sessions, (sid) =>
      eventLog.isActive(sid).pipe(
        Effect.orElseSucceed(() => false),
        Effect.map((active) => (active ? undefined : sid)),
      ),
    );
    const completedSids = Arr.takeRight(
      Arr.filter(results, (sid): sid is SessionId => sid !== undefined),
      5,
    );
    const allObservations = yield* Effect.forEach(completedSids, (sid) =>
      eventLog.observations(sid).pipe(Effect.orElseSucceed((): string[] => [])),
    );
    const flatObs = Arr.flatten(allObservations);
    const matchCount = Arr.length(
      Arr.filter(flatObs, (text) => {
        const lower = text.toLowerCase();
        return FAILURE_KEYWORDS.some((kw) => lower.includes(kw));
      }),
    );
    return matchCount >= 3 ? ANNEAL_SUGGESTION : undefined;
  },
).pipe(Effect.orElseSucceed(() => undefined));

export const injectReminders: GuardFn = (ctx) =>
  Effect.gen(function* () {
    const memoryStoreOption = yield* Effect.serviceOption(MemoryStore);
    const experimentalOption = yield* Effect.serviceOption(ExperimentalFeatures);
    const experimentalParts = Option.match(experimentalOption, {
      onNone: (): readonly string[] => [],
      onSome: (svc) => svc.enabledPrompts,
    });

    const current = ctx.current;
    if (current === undefined || Option.isNone(current.sessionId) || !current.active) {
      const annealSuggestion = yield* checkAnnealSuggestion;
      const base = makeWarning(annealSuggestion);
      const parts =
        experimentalParts.length > 0 ? Arr.join([base, ...experimentalParts], "\n") : base;
      return Warn({ message: parts });
    }

    const task = Option.getOrUndefined(current.task);
    const phase = Option.getOrUndefined(current.phase);

    const memoryParts =
      task !== undefined
        ? Option.map(memoryStoreOption, () => extractKeywords(task)).pipe(
            Option.getOrElse((): readonly string[] => []),
          )
        : [];

    const memoryEntries =
      memoryParts.length > 0
        ? yield* Option.match(memoryStoreOption, {
            onNone: () => Effect.succeed<readonly string[]>([]),
            onSome: (store) =>
              store.query([...memoryParts], { state: "ACTIVE" }).pipe(
                Effect.orElseSucceed((): readonly MemoryNode[] => []),
                Effect.map((memories) => {
                  const minIdx = scaleOrder.indexOf("learning");
                  return Arr.map(
                    Arr.take(
                      Arr.filter(memories, (m) => scaleOrder.indexOf(m.scale) >= minIdx),
                      5,
                    ),
                    (m) => `Memory[${m.scale}]: ${m.name} — ${m.description}`,
                  );
                }),
              ),
          })
        : [];

    const config = yield* Config;
    const annealSuggestion =
      phase === config.terminalPhase ? yield* checkAnnealSuggestion : undefined;

    const parts = [
      ...(task !== undefined ? [`Task: ${task}`] : []),
      ...(phase !== undefined ? [`Phase: ${phase}`] : []),
      ...memoryEntries,
      ...experimentalParts,
      ...(ctx.guard.reminders ?? []),
      ...(annealSuggestion !== undefined ? [annealSuggestion] : []),
    ];

    return Warn({ message: Arr.join(parts, "\n") });
  });
