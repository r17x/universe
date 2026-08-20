import { Array as Arr, Context, Effect, Layer, Ref } from "effect";
import { type DomainEvent, eventSessionId, $match } from "./DomainEvent";

const DEDUP_CAPACITY = 100;

export interface EventDeduplicatorContract {
  readonly isDuplicate: (event: DomainEvent) => Effect.Effect<boolean>;
}

export class EventDeduplicator extends Context.Service<
  EventDeduplicator,
  EventDeduplicatorContract
>()("@anakmagang/EventDeduplicator") {
  static readonly layer = Layer.effect(
    EventDeduplicator,
    Effect.gen(function* () {
      const seenRef = yield* Ref.make<ReadonlyArray<string>>([]);

      const eventKey = (event: DomainEvent): string => {
        const sid = eventSessionId(event) ?? "system";
        const suffix = $match(event, {
          GuardFired: ({ guard, timestamp }) => `guard:${guard}:${timestamp}`,
          PhaseAdvanced: ({ from, to, timestamp }) => `phase:${from}:${to}:${timestamp}`,
          Observed: ({ text, timestamp }) => `obs:${text.slice(0, 20)}:${timestamp}`,
          TranscriptMessage: ({ timestamp }) => `tx:${timestamp}`,
          FileChanged: ({ path, timestamp }) => `file:${path}:${timestamp}`,
          SessionStarted: ({ timestamp }) => `start:${timestamp}`,
          SessionCompleted: ({ timestamp }) => `complete:${timestamp}`,
          Heartbeat: ({ timestamp }) => `hb:${timestamp}`,
          ProjectRegistered: ({ projectId, timestamp }) => `proj:${projectId}:${timestamp}`,
        });
        return `${sid}:${suffix}`;
      };

      const isDuplicate = Effect.fn("EventDeduplicator.isDuplicate")(function* (
        event: DomainEvent,
      ) {
        const key = eventKey(event);
        const seen = yield* Ref.get(seenRef);
        if (Arr.contains(seen, key)) return true;
        yield* Ref.update(seenRef, (buf) =>
          Arr.append(Arr.takeRight(buf, DEDUP_CAPACITY - 1), key),
        );
        return false;
      });

      return EventDeduplicator.of({ isDuplicate });
    }),
  );
}
