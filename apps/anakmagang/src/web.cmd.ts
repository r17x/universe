import * as Effect from "effect/Effect";
import { Layer, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { BunServices } from "@effect/platform-bun";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";
import { startWebServer } from "./server.http";
import { WebRpcs } from "./web.rpc";
import { Config } from "./Config";

const registerWithExisting = (port: number) =>
  Effect.scoped(
    Effect.gen(function* () {
      const config = yield* Config;
      const client = yield* RpcClient.make(WebRpcs);
      return yield* client.RegisterProject({ root: config.root });
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.provide(
          RpcClient.layerProtocolHttp({ url: `http://localhost:${port}/rpc` }),
          Layer.mergeAll(FetchHttpClient.layer, RpcSerialization.layerNdjson),
        ),
        Layer.provide(Config.layer, BunServices.layer),
        BunServices.layer,
      ),
    ),
  );

const shutdownExisting = (port: number) =>
  Effect.scoped(
    Effect.gen(function* () {
      const client = yield* RpcClient.make(WebRpcs);
      return yield* client.Shutdown();
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.provide(
          RpcClient.layerProtocolHttp({ url: `http://localhost:${port}/rpc` }),
          Layer.mergeAll(FetchHttpClient.layer, RpcSerialization.layerNdjson),
        ),
        BunServices.layer,
      ),
    ),
  );

export const webCommand = Command.make(
  "web",
  {
    port: Flag.integer("port").pipe(Flag.withAlias("p"), Flag.optional),
    stop: Flag.boolean("stop"),
  },
  ({ port, stop }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const p = Option.getOrElse(port, () => 3699);

      if (stop) {
        yield* shutdownExisting(p);
        yield* output.emit(Line({ text: `Stopped web server on port ${p}` }));
        return;
      }

      if (Option.isNone(port)) {
        const registered = yield* registerWithExisting(p).pipe(
          Effect.map(Option.some),
          Effect.orElseSucceed(() => Option.none()),
        );
        if (Option.isSome(registered)) {
          yield* output.emit(Line({ text: `Registered with http://localhost:${p}` }));
          return;
        }
      }

      yield* output.emit(Line({ text: `Web dashboard: http://localhost:${p}` }));
      return yield* startWebServer(p, Option.isSome(port));
    }).pipe(
      Effect.catch(() =>
        Effect.gen(function* () {
          const output = yield* Output;
          yield* output.emit(Line({ text: "No running web server found" }));
        }),
      ),
    ),
);
