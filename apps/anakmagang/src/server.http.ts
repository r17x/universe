import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { BunHttpServer, BunServices } from "@effect/platform-bun";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { RpcServer, RpcSerialization } from "effect/unstable/rpc";
import { WebRpcs } from "./web.rpc";
import { WebRpcHandlersLayer } from "./server.rpc";
import { SseRoutesLayer } from "./server.sse";
import { EventLog } from "./EventLog";
import { MachineLoader } from "./MachineLoader";
import { Config } from "./Config";
import { EventBus } from "./EventBus";
import { SocketListener } from "./SocketListener";
import { EventDeduplicator } from "./EventDeduplicator";
import { ConnectionTracker } from "./ConnectionTracker";
import { ProjectRegistry } from "./ProjectRegistry";
import { FileWatcher } from "./FileWatcher";
import { TranscriptWatcher } from "./TranscriptWatcher";
import { ProjectScope } from "./ProjectScope";
import { PhaseEngine } from "./PhaseEngine";
import { DirtyBits } from "./DirtyBits";
import { GuardEvaluator } from "./guard";
import { Bridge } from "./Bridge";
import { MemoryStore } from "./MemoryStore";
import { indexHtml } from "./web.assets";
import { ImageRoutesLayer } from "./web.image";
import appCssPath from "./web.app.css" with { type: "file" };
import appJsPath from "../out/web.app.js" with { type: "file" };

const StaticRoutesLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    yield* router.add("GET", "/", HttpServerResponse.html(indexHtml));
    yield* router.add(
      "GET",
      "/assets/app.css",
      HttpServerResponse.file(appCssPath, { contentType: "text/css" }),
    );
    yield* router.add(
      "GET",
      "/assets/app.js",
      HttpServerResponse.file(appJsPath, { contentType: "application/javascript" }),
    );
  }),
);

const RpcLayer = RpcServer.layerHttp({
  group: WebRpcs,
  path: "/rpc",
  protocol: "http",
});

const AppLayer = Layer.mergeAll(StaticRoutesLayer, RpcLayer, SseRoutesLayer, ImageRoutesLayer);

const webServerLayer = (port: number) =>
  HttpRouter.serve(AppLayer).pipe(
    Layer.provide(BunHttpServer.layer({ port, idleTimeout: 0 })),
    Layer.provide(WebRpcHandlersLayer),
    Layer.provide(RpcSerialization.layerNdjson),
  );

const AutoRegisterLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* Config;
    const registry = yield* ProjectRegistry;
    yield* registry.register(config.root);
  }),
);

export const startWebServer = (port: number, useProjectSocket: boolean) => {
  const socketListenerLayer = useProjectSocket ? SocketListener.layer : SocketListener.userLayer;

  return Effect.sync(() => {
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
  }).pipe(
    Effect.andThen(
      Layer.launch(
        webServerLayer(port).pipe(
          Layer.provide(AutoRegisterLayer),
          Layer.provide(ProjectScope.layer),
          Layer.provide(PhaseEngine.layer),
          Layer.provide(GuardEvaluator.bare),
          Layer.provide(Bridge.layer),
          Layer.provide(DirtyBits.layer),
          Layer.provide(MemoryStore.layerWithSearch),
          Layer.provide(MachineLoader.layer),
          Layer.provide(socketListenerLayer),
          Layer.provide(FileWatcher.layer),
          Layer.provide(TranscriptWatcher.layer),
          Layer.provide(EventLog.layer),
          Layer.provide(EventDeduplicator.layer),
          Layer.provide(ConnectionTracker.layer),
          Layer.provide(ProjectRegistry.layer),
          Layer.provide(EventBus.layer),
          Layer.provide(Config.layer),
          Layer.provide(BunServices.layer),
        ),
      ),
    ),
  );
};
