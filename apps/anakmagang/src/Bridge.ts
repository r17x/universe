// Maps client sessions (Claude Code, OpenCode, etc.) to anakmagang orchestration sessions.

import { Array as Arr, Context, Effect, Layer, Option, Schema } from "effect";
import type { SessionId as SessionIdType } from "./Ulid";
import { EventLog, type EventLogError } from "./EventLog";
import { BridgeData } from "./protocol.GuardConfig";

const BridgeDataList = Schema.Array(BridgeData);

export interface BridgeContract {
  readonly upsert: (
    anakmagangSid: SessionIdType,
    client: string,
    clientSid: string,
    data: Partial<typeof BridgeData.Type>,
  ) => Effect.Effect<void, EventLogError>;

  readonly resolve: (
    client: string,
    clientSid: string,
  ) => Effect.Effect<Option.Option<SessionIdType>, EventLogError>;

  readonly read: (
    anakmagangSid: SessionIdType,
    client: string,
    clientSid: string,
  ) => Effect.Effect<Option.Option<typeof BridgeData.Type>, EventLogError>;
}

const makeBridge = Effect.gen(function* () {
  const eventLog = yield* EventLog;

  const upsert = Effect.fn("Bridge.upsert")(function* (
    anakmagangSid: SessionIdType,
    client: string,
    clientSid: string,
    data: Partial<typeof BridgeData.Type>,
  ) {
    const existing = yield* eventLog.readJson(anakmagangSid, client, clientSid, BridgeDataList);
    const entries = existing ?? [];
    yield* eventLog.writeJson(anakmagangSid, client, clientSid, [...entries, data], BridgeDataList);

    const allKeys = yield* eventLog.listKeys(anakmagangSid, client);
    yield* Effect.forEach(
      Arr.filter(allKeys, (key) => key !== clientSid),
      (staleKey) => eventLog.removeJson(anakmagangSid, client, staleKey),
    );
  });

  const resolve = Effect.fn("Bridge.resolve")(function* (client: string, clientSid: string) {
    const sessions = yield* eventLog.listSessions();
    const reversed = Arr.reverse(sessions);

    const result = yield* Effect.forEach(reversed, (sid) =>
      eventLog.readJson(sid, client, clientSid, BridgeDataList).pipe(
        Effect.map((entries) => entries !== undefined && entries.length > 0),
        Effect.flatMap((hasEntries) =>
          hasEntries
            ? eventLog
                .isActive(sid)
                .pipe(Effect.map((active) => (active ? Option.some(sid) : Option.none())))
            : Effect.succeed(Option.none<SessionIdType>()),
        ),
        Effect.orElseSucceed(() => Option.none<SessionIdType>()),
      ),
    );

    return Arr.findFirst(result, Option.isSome).pipe(Option.flatten);
  });

  const read = Effect.fn("Bridge.read")(function* (
    anakmagangSid: SessionIdType,
    client: string,
    clientSid: string,
  ) {
    const entries = yield* eventLog.readJson(anakmagangSid, client, clientSid, BridgeDataList);
    if (!entries || entries.length === 0) return Option.none<typeof BridgeData.Type>();
    const first = entries[0];
    if (!first) return Option.none<typeof BridgeData.Type>();
    return Option.some(
      Arr.reduce(entries.slice(1), first, (acc, entry) => ({
        ...acc,
        ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined)),
      })),
    );
  });

  return { upsert, resolve, read };
});

export class Bridge extends Context.Service<Bridge, BridgeContract>()("@anakmagang/Bridge") {
  static readonly layer = Layer.effect(Bridge, makeBridge.pipe(Effect.map((c) => Bridge.of(c))));
}
