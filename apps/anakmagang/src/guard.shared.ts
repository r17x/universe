import { Effect, Option } from "effect";
import type { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import type { GuardContext, GuardResult } from "./protocol.GuardResult";
import { EventLog } from "./EventLog";
import { Bridge } from "./Bridge";
import type { Config } from "./Config";

export type GuardDeps = EventLog | FileSystem | Path | Bridge | Config;

export type GuardFn = (ctx: GuardContext) => Effect.Effect<GuardResult, never, GuardDeps>;

export { BridgeData } from "./protocol.GuardConfig";

export const resolveSession = (
  client: string,
  clientSid: string | undefined,
  opts?: { fallback?: boolean },
) =>
  Effect.gen(function* () {
    if (!clientSid) return Option.none<string>();
    const bridge = yield* Bridge;
    const bridgeResult = yield* bridge
      .resolve(client, clientSid)
      .pipe(Effect.orElseSucceed(() => Option.none<string>()));
    if (Option.isSome(bridgeResult)) return bridgeResult;
    if (opts?.fallback) {
      const eventLog = yield* EventLog;
      const active = yield* eventLog
        .findActiveSession()
        .pipe(Effect.orElseSucceed(() => undefined));
      return Option.fromNullishOr(active);
    }
    return Option.none<string>();
  });
