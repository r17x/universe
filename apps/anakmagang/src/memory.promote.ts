import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option, Schema } from "effect"
import { MemoryStore } from "./MemoryStore"

export const memoryPromoteCommand = Command.make(
  "promote",
  {
    id: Argument.string("id").pipe(Argument.withSchema(Schema.NonEmptyString)),
    from: Flag.string("from").pipe(Flag.withAlias("f"), Flag.withDescription("Comma-separated derived-from IDs"), Flag.optional),
    toPermanent: Flag.boolean("to-permanent").pipe(Flag.withAlias("p"), Flag.withDefault(false)),
  },
  ({ id, from, toPermanent }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore
      if (toPermanent) {
        const node = yield* store.read(id)
        if (node.source !== "ephemeral") {
          yield* Console.error(`Node ${id} is already ${node.source}`)
          return
        }
        yield* store.create({
          name: node.name,
          description: node.description,
          type: node.type,
          scale: node.scale,
          tags: [...node.tags],
          body: node.body,
          source: "permanent",
        })
        yield* store.transition(id, "ARCHIVED")
        yield* Console.log(`Promoted to permanent: ${id}`)
        return
      }

      const derivedFromIds = Option.getOrElse(from, () => "").split(",").map((s) => s.trim()).filter((s) => s !== "")
      const node = yield* store.promote(id, derivedFromIds)
      yield* Console.log(`Promoted: ${node.id} -> ${node.scale} (derived from: ${derivedFromIds.join(", ")})`)
    }).pipe(Effect.provide(MemoryStore.layer))
)
