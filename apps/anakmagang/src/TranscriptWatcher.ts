import { Context, Effect, Fiber, Layer, Ref, Schema, Stream } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { Config } from "./Config";
import type { SessionId as SessionIdType } from "./Ulid";
import { TranscriptMessage } from "./DomainEvent";
import { EventBus } from "./EventBus";
import { EventLog } from "./EventLog";
import { extractContent, type ContentBlock } from "./extractContent";

const BridgeEntrySchema = Schema.Struct({
  transcript_path: Schema.String,
  last_seen: Schema.String,
});

const TranscriptLineSchema = Schema.Struct({
  type: Schema.Union([Schema.Literal("user"), Schema.Literal("assistant")]),
  timestamp: Schema.optional(Schema.String),
  message: Schema.Struct({
    content: Schema.optional(Schema.Unknown),
  }),
});

export interface TranscriptWatcherContract {
  readonly watchSession: (sessionId: SessionIdType) => Effect.Effect<void>;
  readonly isWatching: (sessionId: SessionIdType) => Effect.Effect<boolean>;
}

export class TranscriptWatcher extends Context.Service<
  TranscriptWatcher,
  TranscriptWatcherContract
>()("@anakmagang/TranscriptWatcher") {
  static readonly layer = Layer.effect(
    TranscriptWatcher,
    Effect.gen(function* () {
      const config = yield* Config;
      const eventBus = yield* EventBus;
      const eventLog = yield* EventLog;
      const fs = yield* FileSystem;
      const path = yield* Path;

      const offsetsRef = yield* Ref.make<Map<string, { offset: number; startTime: string }>>(
        new Map(),
      );
      const watchersRef = yield* Ref.make<Map<string, Fiber.Fiber<void>>>(new Map());
      const watchedSessionsRef = yield* Ref.make<Set<string>>(new Set());

      const startWatchingTranscript = Effect.fn("TranscriptWatcher.startWatchingTranscript")(
        function* (
          transcriptPath: string,
          sessionId: SessionIdType,
          provider: string,
          providerSessionId: string,
          startTime: string,
        ) {
          const watchers = yield* Ref.get(watchersRef);
          if (watchers.has(transcriptPath)) return;

          const exists = yield* fs.exists(transcriptPath).pipe(Effect.orElseSucceed(() => false));
          if (!exists) return;

          const stat = yield* fs
            .stat(transcriptPath)
            .pipe(Effect.orElseSucceed(() => ({ size: 0 })));
          yield* Ref.update(offsetsRef, (m) =>
            new Map(m).set(transcriptPath, { offset: Number(stat.size), startTime }),
          );

          const fiber = yield* fs.watch(transcriptPath).pipe(
            Stream.filter((e) => e._tag === "Update"),
            Stream.runForEach(() =>
              processChange(transcriptPath, sessionId, provider, providerSessionId),
            ),
            Effect.catch(() => Effect.void),
            Effect.forkChild,
          );

          yield* Ref.update(watchersRef, (m) => new Map(m).set(transcriptPath, fiber));
        },
      );

      const processChange = Effect.fn("TranscriptWatcher.processChange")(function* (
        transcriptPath: string,
        sessionId: SessionIdType,
        provider: string,
        providerSessionId: string,
      ) {
        const offsets = yield* Ref.get(offsetsRef);
        const entry = offsets.get(transcriptPath);
        const offset = entry?.offset ?? 0;
        const startTime = entry?.startTime ?? "";

        const file = Bun.file(transcriptPath);
        const slice = file.slice(offset);
        const text = yield* Effect.tryPromise(() => slice.text());

        if (text.length === 0) return;

        yield* Ref.update(offsetsRef, (m) =>
          new Map(m).set(transcriptPath, {
            offset: offset + new TextEncoder().encode(text).byteLength,
            startTime,
          }),
        );

        const lines = text.split("\n").filter(Boolean);

        yield* Effect.forEach(lines, (line) =>
          Effect.gen(function* () {
            const parsed = yield* Schema.decodeUnknownEffect(
              Schema.fromJsonString(TranscriptLineSchema),
            )(line).pipe(Effect.orElseSucceed(() => null));
            if (parsed === null) return;

            const timestamp = parsed.timestamp ?? "";
            if (startTime && timestamp < startTime) return;

            const content =
              typeof parsed.message.content === "string" || Array.isArray(parsed.message.content)
                ? extractContent(parsed.message.content as string | ReadonlyArray<ContentBlock>)
                : "";

            if (content.length === 0) return;

            yield* eventBus.publish(
              TranscriptMessage({
                sessionId,
                provider,
                providerSessionId,
                role: parsed.type,
                content,
                timestamp,
              }),
            );
          }),
        );
      });

      const watchSession = Effect.fn("TranscriptWatcher.watchSession")(function* (
        sessionId: SessionIdType,
      ) {
        yield* Ref.update(watchedSessionsRef, (s) => new Set(s).add(sessionId));

        const providerSessions = yield* eventLog
          .listProviderSessions(sessionId)
          .pipe(
            Effect.orElseSucceed(
              (): ReadonlyArray<{ provider: string; sessionIds: ReadonlyArray<string> }> => [],
            ),
          );

        yield* Effect.forEach(providerSessions, (ps) =>
          Effect.forEach(ps.sessionIds, (psId) =>
            Effect.gen(function* () {
              const bridgePath = path.join(config.outDir, sessionId, ps.provider, `${psId}.json`);
              const bridgeContent = yield* fs
                .readFileString(bridgePath)
                .pipe(Effect.orElseSucceed(() => "[]"));
              const entries = yield* Schema.decodeUnknownEffect(
                Schema.fromJsonString(Schema.Array(BridgeEntrySchema)),
              )(bridgeContent).pipe(Effect.orElseSucceed(() => []));
              const sessionStartTime = entries.length > 0 ? (entries[0]?.last_seen ?? "") : "";
              yield* Effect.forEach(entries, (entry) =>
                startWatchingTranscript(
                  entry.transcript_path,
                  sessionId,
                  ps.provider,
                  psId,
                  sessionStartTime,
                ),
              );
            }),
          ),
        );
      });

      const isWatching = Effect.fn("TranscriptWatcher.isWatching")(function* (
        sessionId: SessionIdType,
      ) {
        const sessions = yield* Ref.get(watchedSessionsRef);
        return sessions.has(sessionId);
      });

      const sessions = yield* eventLog
        .listSessions()
        .pipe(Effect.orElseSucceed((): readonly SessionIdType[] => []));
      const activeSessions = yield* Effect.filter(sessions, (sid) =>
        eventLog.isActive(sid).pipe(Effect.orElseSucceed(() => false)),
      );
      yield* Effect.forEach(activeSessions, (sid) => watchSession(sid));

      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          const watchers = yield* Ref.get(watchersRef);
          yield* Effect.forEach(watchers.values(), (fiber) => Fiber.interrupt(fiber));
          yield* Ref.set(watchersRef, new Map());
        }),
      );

      return TranscriptWatcher.of({ watchSession, isWatching });
    }),
  );
}
