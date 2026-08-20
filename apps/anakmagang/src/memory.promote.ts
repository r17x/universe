import { Argument, Command, Flag } from "effect/unstable/cli";
import { Effect, Option, Schema } from "effect";
import { MemoryStore } from "./MemoryStore";
import { Output } from "./protocol.Output";
import { Line, Record, Diagnostic } from "./protocol.Emission";

export const memoryPromoteCommand = Command.make(
  "promote",
  {
    id: Argument.string("id").pipe(Argument.withSchema(Schema.NonEmptyString)),
    from: Flag.string("from").pipe(
      Flag.withAlias("f"),
      Flag.withDescription("Comma-separated derived-from IDs"),
      Flag.optional,
    ),
    toPermanent: Flag.boolean("to-permanent").pipe(Flag.withAlias("p"), Flag.withDefault(false)),
  },
  ({ id, from, toPermanent }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore;
      const output = yield* Output;
      if (toPermanent) {
        const node = yield* store.read(id);
        if (node.source !== "ephemeral") {
          yield* output.emit(
            Diagnostic({ severity: "error", message: `Node ${id} is already ${node.source}` }),
          );
          return;
        }
        yield* store.create({
          name: node.name,
          description: node.description,
          type: node.type,
          scale: node.scale,
          tags: [...node.tags],
          body: node.body,
          source: "permanent",
        });
        yield* store.transition(id, "ARCHIVED");
        yield* output.emit(Line({ text: `Promoted to permanent: ${id}` }));
        return;
      }

      const derivedFromIds = Option.getOrElse(from, () => "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const node = yield* store.promote(id, derivedFromIds);
      yield* output.emit(
        Record({
          fields: [
            ["id", node.id],
            ["scale", node.scale],
            ["derived_from", derivedFromIds.join(", ")],
          ],
        }),
      );
    }).pipe(Effect.provide(MemoryStore.layer)),
);
