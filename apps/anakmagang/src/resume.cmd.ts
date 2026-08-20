import { Command, Flag } from "effect/unstable/cli";
import { Clock, Effect } from "effect";
import { SessionId } from "./Ulid";
import { PhaseEngine } from "./PhaseEngine";
import { PhaseEngineLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Record } from "./protocol.Emission";
import { notifyEvent } from "./notify";
import { PhaseAdvanced } from "./DomainEvent";
import { $match as $matchEvalResult } from "./protocol.EvalResult";

const now = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString());

export const resumeCommand = Command.make(
  "resume",
  {
    session: Flag.string("session"),
    client: Flag.string("client").pipe(Flag.optional),
  },
  ({ session: rawSession, client: _client }) =>
    Effect.gen(function* () {
      const session = SessionId(rawSession);
      const engine = yield* PhaseEngine;
      const output = yield* Output;
      const result = yield* engine.resume(session);
      const ts = yield* now;

      yield* $matchEvalResult(result, {
        Advanced: (r) =>
          Effect.gen(function* () {
            yield* notifyEvent(
              PhaseAdvanced({
                sessionId: r.sessionId,
                from: `${r.from.number}/${r.from.id}`,
                to: `${r.to.number}/${r.to.id}`,
                reflection: "session resumed",
                timestamp: ts,
              }),
            );
            const fields: Array<readonly [string, string]> = [
              ["session", r.sessionId],
              ["transition", "resumed"],
              ["rule", r.rule],
              ["phase", r.to.id],
              ["question", r.question],
            ];
            yield* output.emit(Record({ fields }));
          }),
        LoopedBack: (r) =>
          output.emit(
            Record({
              fields: [
                ["session", r.sessionId],
                ["transition", "back"],
                ["rule", r.rule],
              ],
            }),
          ),
        Completed: (r) =>
          output.emit(
            Record({
              fields: [
                ["session", r.sessionId],
                ["transition", "complete"],
                ["rule", r.rule],
              ],
            }),
          ),
        Blocked: (r) =>
          output.emit(
            Record({
              fields: [
                ["session", r.sessionId],
                ["transition", "blocked"],
                ["guard", r.guard],
                ["message", r.message],
              ],
            }),
          ),
      });
    }).pipe(Effect.provide(PhaseEngineLayers)),
);
