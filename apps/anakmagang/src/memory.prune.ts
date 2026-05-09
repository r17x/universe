import { Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option } from "effect"
import { MemoryStore } from "./MemoryStore"

const DEFAULT_THRESHOLDS: Record<string, number> = {
  user: 10,
  feedback: 3,
  project: 5,
  reference: 8,
}

export const memoryPruneCommand = Command.make(
  "prune",
  {
    dryRun: Flag.boolean("dry-run").pipe(Flag.withAlias("d"), Flag.withDefault(false)),
    source: Flag.choice("source", ["permanent", "ephemeral"] as const).pipe(Flag.optional),
  },
  ({ dryRun, source }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore
      const sourceFilter = Option.getOrUndefined(source)
      if (dryRun) {
        const all = yield* store.list({ state: "ACTIVE", source: sourceFilter })
        const wouldPrune = all.filter((n) => {
          const threshold = DEFAULT_THRESHOLDS[n.type]
          return threshold !== undefined && n.session_count > threshold
        })
        if (wouldPrune.length === 0) {
          yield* Console.log("No nodes would be pruned.")
          return
        }
        for (const n of wouldPrune) {
          yield* Console.log(`Would prune: ${n.id} (${n.type}, sessions=${n.session_count}, source=${n.source})`)
        }
        return
      }
      const pruned = yield* store.prune(DEFAULT_THRESHOLDS)
      if (pruned.length === 0) {
        yield* Console.log("No nodes pruned.")
        return
      }
      for (const n of pruned) {
        yield* Console.log(`Pruned: ${n.id} -> ${n.state}`)
      }
    }).pipe(Effect.provide(MemoryStore.layer))
)
