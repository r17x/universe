import { Argument, Command, Flag } from "effect/unstable/cli";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { PhaseEngine } from "./PhaseEngine";
import { PhaseEngineLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";

export const draftCommand = Command.make(
  "draft",
  {
    task: Argument.string("task").pipe(Argument.withSchema(Schema.NonEmptyString)),
    client: Flag.string("client").pipe(Flag.optional),
  },
  ({ task, client: _client }) =>
    Effect.gen(function* () {
      const engine = yield* PhaseEngine;
      const output = yield* Output;
      const sessionId = yield* engine.draft(task);
      yield* output.emit(Line({ text: sessionId }));
    }).pipe(Effect.provide(PhaseEngineLayers)),
);
