import { Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, Option } from "effect";
import { HookLayers } from "./hook";
import { loadGuards } from "./Layers";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";

export const hookListCommand = Command.make(
  "list",
  {
    event: Flag.string("event").pipe(Flag.withAlias("e"), Flag.optional),
    type: Flag.string("type").pipe(Flag.withAlias("t"), Flag.optional),
  },
  ({ event, type }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const allGuards = yield* loadGuards;
      if (allGuards.length === 0) {
        yield* output.emit(Line({ text: "No guards configured." }));
        return;
      }

      const guards = Arr.filter(allGuards, (guard) => {
        if (
          Option.isSome(event) &&
          (guard.event === undefined ||
            !guard.event.toLowerCase().includes(event.value.toLowerCase()))
        )
          return false;
        if (Option.isSome(type) && !guard.type.toLowerCase().includes(type.value.toLowerCase()))
          return false;
        return true;
      });

      if (guards.length === 0) {
        yield* output.emit(Line({ text: "No matching guards." }));
        return;
      }
      yield* Effect.forEach(guards, (guard) => {
        const parts = [
          guard.type,
          ...(guard.event !== undefined ? [`[${guard.event}]`] : []),
          ...(guard.matcher !== undefined ? [`(${guard.matcher})`] : []),
          ...(guard.description !== undefined ? [guard.description] : []),
          ...(guard.enforced_by !== undefined ? [`enforced_by:${guard.enforced_by}`] : []),
        ];
        return output.emit(Line({ text: parts.join("  ") }));
      });
    }).pipe(Effect.provide(HookLayers)),
);
