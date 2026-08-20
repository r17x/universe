import { Context, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, type RpcClientError, RpcSerialization } from "effect/unstable/rpc";

import { WebRpcs } from "./web.rpc";

type WebRpcClient = RpcClient.FromGroup<typeof WebRpcs, RpcClientError.RpcClientError>;

export class WebClient extends Context.Service<WebClient, WebRpcClient>()(
  "@anakmagang/WebClient",
) {}

export const WebClientLive = Layer.effect(WebClient, RpcClient.make(WebRpcs)).pipe(
  Layer.provide(RpcClient.layerProtocolHttp({ url: "/rpc" })),
  Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
);
