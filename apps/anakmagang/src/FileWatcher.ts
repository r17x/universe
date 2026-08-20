import { Context, Effect, Fiber, Layer, Ref, Stream } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Config } from "./Config";
import { ConnectionTracker } from "./ConnectionTracker";
import { TranscriptWatcher } from "./TranscriptWatcher";
import { SessionId } from "./Ulid";

export interface FileWatcherContract {
  readonly isRunning: Effect.Effect<boolean>;
}

export class FileWatcher extends Context.Service<FileWatcher, FileWatcherContract>()(
  "@anakmagang/FileWatcher",
) {
  static readonly layer = Layer.effect(
    FileWatcher,
    Effect.gen(function* () {
      const config = yield* Config;
      const tracker = yield* ConnectionTracker;
      const transcriptWatcher = yield* TranscriptWatcher;
      const fsSvc = yield* FileSystem;

      const outDir = config.outDir;
      const runningRef = yield* Ref.make(false);

      const fiber = yield* fsSvc.watch(outDir).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            if (event.path.includes("/claude/") && event.path.endsWith(".json")) {
              const rawSessionId = event.path.split("/")[0];
              if (rawSessionId) yield* transcriptWatcher.watchSession(SessionId(rawSessionId));
              return;
            }

            if (!event.path.endsWith("manifest.yaml")) return;

            const hasClients = yield* tracker.hasClients;
            if (!hasClients) return;
          }),
        ),
        Effect.catch(() => Effect.void),
        Effect.forkChild,
      );

      yield* Ref.set(runningRef, true);

      yield* Effect.addFinalizer(() => Fiber.interrupt(fiber));

      return FileWatcher.of({ isRunning: Ref.get(runningRef) });
    }),
  );
}
