import { Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, Option } from "effect";
import { MemoryStore } from "./MemoryStore";
import { Output } from "./protocol.Output";
import { Line, Record } from "./protocol.Emission";

const DEFAULT_THRESHOLDS: globalThis.Record<string, number> = {
  user: 10,
  feedback: 3,
  project: 5,
  reference: 8,
};

export const memoryPruneCommand = Command.make(
  "prune",
  {
    dryRun: Flag.boolean("dry-run").pipe(Flag.withAlias("d"), Flag.withDefault(false)),
    source: Flag.choice("source", ["permanent", "ephemeral"] as const).pipe(Flag.optional),
  },
  ({ dryRun, source }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore;
      const output = yield* Output;
      const sourceFilter = Option.getOrUndefined(source);
      if (dryRun) {
        const all = yield* store.list({ state: "ACTIVE", source: sourceFilter });
        const wouldPrune = Arr.filter(all, (n) => {
          const threshold = DEFAULT_THRESHOLDS[n.type];
          return threshold !== undefined && n.session_count > threshold;
        });
        if (wouldPrune.length === 0) {
          yield* output.emit(Line({ text: "No nodes would be pruned." }));
          return;
        }
        yield* Effect.forEach(wouldPrune, (n) =>
          output.emit(
            Record({
              fields: [
                ["id", n.id],
                ["type", n.type],
                ["sessions", String(n.session_count)],
                ["source", n.source],
              ],
            }),
          ),
        );
        return;
      }
      const pruned = yield* store.prune(DEFAULT_THRESHOLDS);
      if (pruned.length === 0) {
        yield* output.emit(Line({ text: "No nodes pruned." }));
        return;
      }
      yield* Effect.forEach(pruned, (n) =>
        output.emit(
          Record({
            fields: [
              ["id", n.id],
              ["state", n.state],
            ],
          }),
        ),
      );
    }).pipe(Effect.provide(MemoryStore.layer)),
);
