import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option, Schema } from "effect"
import { MemoryStore } from "./MemoryStore"

export const memoryCreateCommand = Command.make(
  "create",
  {
    name: Argument.string("name").pipe(Argument.withSchema(Schema.NonEmptyString)),
    type: Flag.choice("type", ["user", "feedback", "project", "reference"] as const).pipe(Flag.withAlias("T")),
    description: Flag.string("description").pipe(Flag.withAlias("d")),
    scale: Flag.choice("scale", ["observation", "finding", "learning", "principle"] as const).pipe(Flag.withAlias("s"), Flag.optional),
    tag: Flag.string("tag").pipe(Flag.withAlias("t"), Flag.optional),
    source: Flag.choice("source", ["permanent", "ephemeral"] as const).pipe(Flag.optional),
  },
  ({ name, type, description, scale, tag, source }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore
      const tags = Option.isSome(tag) ? [tag.value] : undefined
      const node = yield* store.create({
        name,
        type,
        description,
        scale: Option.getOrUndefined(scale),
        tags,
        source: Option.getOrUndefined(source),
      })
      yield* Console.log(`Created: ${node.id} (${node.scale}, ${node.state}, ${node.source})`)
    }).pipe(Effect.provide(MemoryStore.layer))
)
