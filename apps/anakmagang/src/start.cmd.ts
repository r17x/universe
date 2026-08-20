import { Argument, Command, Flag } from "effect/unstable/cli";
import { Clock, Effect, Schema } from "effect";
import { notifyEvent } from "./notify";
import { SessionStarted } from "./DomainEvent";
import { PhaseEngine } from "./PhaseEngine";
import { PhaseEngineLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Line, Record } from "./protocol.Emission";

export const startCommand = Command.make(
  "start",
  {
    task: Argument.string("task").pipe(Argument.withSchema(Schema.NonEmptyString)),
    client: Flag.string("client").pipe(Flag.optional, Flag.withAlias("c")),
  },
  ({ task }) =>
    Effect.gen(function* () {
      const engine = yield* PhaseEngine;
      const output = yield* Output;
      const result = yield* engine.start(task);
      const ts = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString());
      yield* notifyEvent(SessionStarted({ sessionId: result.sessionId, task, timestamp: ts }));
      yield* output.emit(
        Record({
          fields: [
            ["session", result.sessionId],
            ["phase", `${result.phase.number}/${result.phase.id}`],
            ["question", result.question],
          ],
        }),
      );
      if (result.memories.length > 0) {
        yield* output.emit(Line({ text: "---" }));
        yield* Effect.forEach(result.memories, (m) =>
          output.emit(
            Record({
              fields: [
                ["scale", m.scale],
                ["name", m.name],
                ["description", m.description],
              ],
            }),
          ),
        );
      }
    }).pipe(Effect.provide(PhaseEngineLayers)),
);
