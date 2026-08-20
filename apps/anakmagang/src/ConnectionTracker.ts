import { Context, Effect, Layer, Ref, type Scope } from "effect";

export interface ConnectionTrackerContract {
  readonly connect: Effect.Effect<void, never, Scope.Scope>;
  readonly count: Effect.Effect<number>;
  readonly hasClients: Effect.Effect<boolean>;
}

export class ConnectionTracker extends Context.Service<
  ConnectionTracker,
  ConnectionTrackerContract
>()("@anakmagang/ConnectionTracker") {
  static readonly layer = Layer.effect(
    ConnectionTracker,
    Effect.gen(function* () {
      const countRef = yield* Ref.make(0);

      const connect = Effect.gen(function* () {
        yield* Ref.update(countRef, (n) => n + 1);
        yield* Effect.addFinalizer(() => Ref.update(countRef, (n) => n - 1));
      });

      const count = Ref.get(countRef);
      const hasClients = Ref.get(countRef).pipe(Effect.map((n) => n > 0));

      return ConnectionTracker.of({ connect, count, hasClients });
    }),
  );
}
