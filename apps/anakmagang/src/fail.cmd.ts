import { Command, Flag } from "effect/unstable/cli";
import { Effect } from "effect";
import { SessionId } from "./Ulid";
import { PhaseEngine } from "./PhaseEngine";
import { PhaseEngineLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Record, Line } from "./protocol.Emission";

export const failCommand = Command.make(
  "fail",
  {
    session: Flag.string("session"),
    reason: Flag.string("reason"),
    client: Flag.string("client").pipe(Flag.optional),
  },
  ({ session: rawSession, reason, client: _client }) =>
    Effect.gen(function* () {
      const session = SessionId(rawSession);
      const engine = yield* PhaseEngine;
      const output = yield* Output;
      const { compensations } = yield* engine.fail(session, reason);

      if (compensations.length === 0) {
        yield* output.emit(Line({ text: "Session failed. No compensations registered." }));
      } else {
        yield* Effect.forEach(compensations, (c) =>
          output.emit(
            Record({
              fields: [
                ["phase", c.phase],
                ["action", c.action],
                ["result", c.result],
              ],
            }),
          ),
        );
      }

      yield* output.emit(
        Record({
          fields: [
            ["session", session],
            ["status", "failed"],
            ["reason", reason],
          ],
        }),
      );
    }).pipe(Effect.provide(PhaseEngineLayers)),
);
