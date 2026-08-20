import { Array as A, Context, Effect, Layer, Queue, Result, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Config, type ConfigContract } from "./Config";
import { EventBus } from "./EventBus";
import { EventDeduplicator } from "./EventDeduplicator";
import { DomainEventSchema } from "./DomainEvent";

export interface SocketListenerContract {
  readonly socketPath: string;
}

const makeEffect = (getSocketPath: (config: ConfigContract) => string) =>
  Effect.gen(function* () {
    const config = yield* Config;
    const fs = yield* FileSystem;
    const eventBus = yield* EventBus;
    const dedup = yield* EventDeduplicator;

    const socketPath = getSocketPath(config);

    const parentDir = socketPath.substring(0, socketPath.lastIndexOf("/"));
    yield* fs.makeDirectory(parentDir, { recursive: true }).pipe(Effect.ignore);

    yield* fs.remove(socketPath).pipe(Effect.ignore);

    const queue = yield* Queue.unbounded<typeof DomainEventSchema.Type>();

    yield* Effect.forever(
      Effect.gen(function* () {
        const event = yield* Queue.take(queue);
        const isDup = yield* dedup.isDuplicate(event);
        if (!isDup) yield* eventBus.publish(event);
      }),
    ).pipe(Effect.forkScoped);

    const server = Bun.listen({
      unix: socketPath,
      socket: {
        data(_socket, data) {
          const lines = new TextDecoder().decode(data).split("\n").filter(Boolean);
          const events = A.filterMap(lines, (line) =>
            Result.try(() =>
              Schema.decodeUnknownSync(Schema.fromJsonString(DomainEventSchema))(line),
            ),
          );
          A.forEach(events, (event) => Queue.offerUnsafe(queue, event));
        },
      },
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => server.stop()).pipe(
        Effect.andThen(fs.remove(socketPath).pipe(Effect.ignore)),
      ),
    );

    return SocketListener.of({ socketPath });
  });

export class SocketListener extends Context.Service<SocketListener, SocketListenerContract>()(
  "@anakmagang/SocketListener",
) {
  static readonly layer = Layer.effect(
    SocketListener,
    makeEffect((config) => config.socketPath),
  );
  static readonly userLayer = Layer.effect(
    SocketListener,
    makeEffect((config) => config.webSocketPath),
  );
}
