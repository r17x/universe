import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect";
import { type DomainEvent, eventSessionId } from "./DomainEvent";

export interface EventBusContract {
  readonly publish: (event: DomainEvent) => Effect.Effect<void>;
  readonly subscribe: Effect.Effect<Stream.Stream<DomainEvent>, never, Scope.Scope>;
  readonly subscribeSession: (
    sessionId: string,
  ) => Effect.Effect<Stream.Stream<DomainEvent>, never, Scope.Scope>;
  readonly pubsub: PubSub.PubSub<DomainEvent>;
}

export class EventBus extends Context.Service<EventBus, EventBusContract>()(
  "@anakmagang/EventBus",
) {
  static readonly layer = Layer.effect(
    EventBus,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.dropping<DomainEvent>({ capacity: 256, replay: 50 });

      const publish = Effect.fn("EventBus.publish")(function* (event: DomainEvent) {
        yield* PubSub.publish(pubsub, event);
      });

      const subscribe = Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(pubsub);
        return Stream.fromSubscription(subscription);
      });

      const subscribeSession = Effect.fn("EventBus.subscribeSession")(function* (
        sessionId: string,
      ) {
        const subscription = yield* PubSub.subscribe(pubsub);
        return Stream.fromSubscription(subscription).pipe(
          Stream.filter((event) => eventSessionId(event) === sessionId),
        );
      });

      return EventBus.of({ publish, subscribe, subscribeSession, pubsub });
    }),
  );
}
