import { Array as Arr, Data, Option } from "effect";
import type { ParsedManifestEntry } from "./EventLog";
import type { SessionId } from "./Ulid";

export type SessionState = Data.TaggedEnum<{
  Draft: { readonly sessionId: SessionId };
  Active: { readonly sessionId: SessionId; readonly phase: string };
  Suspended: {
    readonly sessionId: SessionId;
    readonly phase: string;
    readonly reason: string;
    readonly guard: string;
  };
  Completed: { readonly sessionId: SessionId };
  Failed: {
    readonly sessionId: SessionId;
    readonly phase: string;
    readonly reason: string;
  };
}>;

const _SessionState = Data.taggedEnum<SessionState>();
export const Draft = _SessionState.Draft;
export const Active = _SessionState.Active;
export const Suspended = _SessionState.Suspended;
export const SessionCompleted = _SessionState.Completed;
export const Failed = _SessionState.Failed;
export const $is = _SessionState.$is;
export const $match = _SessionState.$match;

export const deriveState = (
  sessionId: SessionId,
  events: ReadonlyArray<ParsedManifestEntry>,
): SessionState => {
  const reversed = Arr.reverse(events);
  const lastStateEvent = Arr.findFirst(
    reversed,
    (e) =>
      e.type === "session_suspended" ||
      e.type === "session_resumed" ||
      e.type === "session_failed" ||
      e.type === "phase_advance" ||
      e.type === "session_init" ||
      e.type === "task_start",
  );
  return lastStateEvent.pipe(
    Option.match({
      onNone: () => Draft({ sessionId }),
      onSome: (event) => {
        switch (event.type) {
          case "session_suspended":
            return Suspended({
              sessionId,
              phase: event["phase"] ?? "",
              reason: event["reason"] ?? "",
              guard: event["guard"] ?? "",
            });
          case "session_failed":
            return Failed({
              sessionId,
              phase: event["phase"] ?? "",
              reason: event["reason"] ?? "",
            });
          case "phase_advance":
            return event["next_phase"] === undefined
              ? SessionCompleted({ sessionId })
              : Active({ sessionId, phase: event["next_phase"] });
          case "session_resumed":
            return Active({ sessionId, phase: event["phase"] ?? "" });
          default:
            return event.type === "session_init"
              ? Active({ sessionId, phase: event["phase"] ?? "setup" })
              : Draft({ sessionId });
        }
      },
    }),
  );
};
