import { Clock, Effect, Layer, Schedule, Stream } from "effect";
import { HttpRouter, HttpServerResponse, HttpServerRequest } from "effect/unstable/http";
import { EventBus } from "./EventBus";
import { Heartbeat, formatSSE, eventSessionId } from "./DomainEvent";

const heartbeat = Stream.fromEffectSchedule(
  Effect.map(Clock.currentTimeMillis, (ms) => Heartbeat({ timestamp: new Date(ms).toISOString() })),
  Schedule.spaced("30 seconds"),
);

export const SseRoutesLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    const eventBus = yield* EventBus;

    yield* router.add(
      "GET",
      "/events",
      Effect.gen(function* () {
        const req = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL(req.url, "http://localhost");
        const sessionId = url.searchParams.get("session");

        const events = sessionId
          ? Stream.fromPubSub(eventBus.pubsub).pipe(
              Stream.filter((event) => eventSessionId(event) === sessionId),
            )
          : Stream.fromPubSub(eventBus.pubsub);

        const merged = Stream.merge(events, heartbeat);
        const encoded = Stream.encodeText(Stream.map(merged, formatSSE));
        return HttpServerResponse.stream(encoded, {
          contentType: "text/event-stream",
          headers: { "Cache-Control": "no-cache", Connection: "keep-alive" },
        });
      }),
    );
  }),
);
