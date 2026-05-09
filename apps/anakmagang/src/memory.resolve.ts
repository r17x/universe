import { Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option, Schema } from "effect"
import { MemoryStore } from "./MemoryStore"

export const memoryResolveCommand = Command.make(
  "resolve",
  {
    query: Flag.string("query").pipe(Flag.withSchema(Schema.NonEmptyString), Flag.withAlias("q")),
    tag: Flag.string("tag").pipe(Flag.withAlias("t"), Flag.optional),
    scale: Flag.string("scale").pipe(Flag.withAlias("s"), Flag.optional),
    state: Flag.string("state").pipe(Flag.withAlias("S"), Flag.optional),
    source: Flag.choice("source", ["permanent", "ephemeral"] as const).pipe(Flag.optional),
  },
  ({ query, tag, scale, state, source }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore
      const filter = {
        text: query,
        tag: Option.getOrUndefined(tag),
        scale: Option.getOrUndefined(scale),
        state: Option.getOrUndefined(state),
        source: Option.getOrUndefined(source),
      }
      const all = (yield* store.list(filter)).slice(0, 8)
      if (all.length === 0) {
        yield* Console.log("No matching memories found.")
        return
      }
      for (const n of all) {
        yield* Console.log(`[${n.source}] ${n.id}  ${n.name}  [${n.scale}/${n.state}]  tags=${n.tags.join(",")}`)
      }
    }).pipe(Effect.provide(MemoryStore.layer))
)
