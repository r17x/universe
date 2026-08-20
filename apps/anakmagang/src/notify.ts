import { Effect } from "effect";
import type { DomainEvent } from "./DomainEvent";
import { Config } from "./Config";

export const notifyEventSync = (event: DomainEvent, socketPath: string): void => {
  Bun.connect({
    unix: socketPath,
    socket: {
      open(socket) {
        socket.write(JSON.stringify(event) + "\n");
        socket.end();
      },
      data() {},
      error() {},
    },
  }).catch(() => {});
};

export const notifyEvent = (event: DomainEvent): Effect.Effect<void, never, Config> =>
  Effect.gen(function* () {
    const config = yield* Config;
    notifyEventSync(event, config.socketPath);
    if (config.webSocketPath !== config.socketPath) {
      notifyEventSync(event, config.webSocketPath);
    }
  });
