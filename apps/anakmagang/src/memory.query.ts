import { Command, Flag } from "effect/unstable/cli";
import { Effect, Option } from "effect";
import { MemoryStore } from "./MemoryStore";
import { Output } from "./protocol.Output";
import { Line, Record } from "./protocol.Emission";

export const memoryQueryCommand = Command.make(
  "query",
  {
    tag: Flag.string("tag").pipe(Flag.withAlias("t"), Flag.optional),
    scale: Flag.string("scale").pipe(Flag.withAlias("s"), Flag.optional),
    state: Flag.string("state").pipe(Flag.withAlias("S"), Flag.optional),
    text: Flag.string("text").pipe(Flag.withAlias("q"), Flag.optional),
    source: Flag.choice("source", ["permanent", "ephemeral"] as const).pipe(Flag.optional),
  },
  ({ tag, scale, state, text, source }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore;
      const output = yield* Output;
      const nodes = yield* store.list({
        tag: Option.getOrUndefined(tag),
        scale: Option.getOrUndefined(scale),
        state: Option.getOrUndefined(state),
        text: Option.getOrUndefined(text),
        source: Option.getOrUndefined(source),
      });
      if (nodes.length === 0) {
        yield* output.emit(Line({ text: "No matching memories found." }));
        return;
      }
      yield* Effect.forEach(nodes, (n) =>
        output.emit(
          Record({
            fields: [
              ["id", n.id],
              ["name", n.name],
              ["scale", n.scale],
              ["state", n.state],
              ["source", n.source],
              ["tags", n.tags.join(",")],
            ],
          }),
        ),
      );
    }).pipe(Effect.provide(MemoryStore.layer)),
);
