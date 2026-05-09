import { Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option } from "effect"
import { MemoryStore } from "./MemoryStore"

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
      const store = yield* MemoryStore
      const nodes = yield* store.list({
        tag: Option.getOrUndefined(tag),
        scale: Option.getOrUndefined(scale),
        state: Option.getOrUndefined(state),
        text: Option.getOrUndefined(text),
        source: Option.getOrUndefined(source),
      })
      if (nodes.length === 0) {
        yield* Console.log("No matching memories found.")
        return
      }
      for (const n of nodes) {
        yield* Console.log(`${n.id}  ${n.name}  [${n.scale}/${n.state}]  source=${n.source}  tags=${n.tags.join(",")}`)
      }
    }).pipe(Effect.provide(MemoryStore.layer))
)
