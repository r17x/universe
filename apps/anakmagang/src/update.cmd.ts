import { Argument, Command, Flag } from "effect/unstable/cli";
import { Clock, DateTime, Effect, Schema } from "effect";
import { SessionId } from "./Ulid";
import { notifyEvent } from "./notify";
import { Observed } from "./DomainEvent";
import { EventLog } from "./EventLog";
import { ConfigEventLogLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Record } from "./protocol.Emission";

export const updateCommand = Command.make(
  "update",
  {
    key: Argument.string("key").pipe(Argument.withSchema(Schema.NonEmptyString)),
    value: Argument.string("value").pipe(Argument.withSchema(Schema.NonEmptyString)),
    session: Flag.string("session"),
    client: Flag.string("client").pipe(Flag.optional),
  },
  ({ key, value, session: rawSession, client: _client }) =>
    Effect.gen(function* () {
      const session = SessionId(rawSession);
      const eventLog = yield* EventLog;
      const output = yield* Output;

      const now = yield* Clock.currentTimeMillis;
      const ts = DateTime.formatIso(DateTime.makeUnsafe(now));
      yield* eventLog.appendManifest(session, {
        type: "observation",
        text: `${key}: ${value}`,
        ts,
      });
      yield* notifyEvent(Observed({ sessionId: session, text: `${key}: ${value}`, timestamp: ts }));
      yield* output.emit(
        Record({
          fields: [
            ["session", session],
            ["type", "observation"],
            ["key", key],
            ["value", value],
          ],
        }),
      );
    }).pipe(Effect.provide(ConfigEventLogLayers)),
);
