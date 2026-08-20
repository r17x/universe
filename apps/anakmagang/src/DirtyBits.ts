import { Array as Arr, Context, Effect, Layer, Schema, Stream, pipe } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import { Config } from "./Config";
import { EventLog } from "./EventLog";
import type { SessionId as SessionIdType } from "./Ulid";

export class DirtyBitsError extends Schema.TaggedErrorClass<DirtyBitsError>()("DirtyBitsError", {
  message: Schema.String,
}) {}

export type OnAdvanceCommand = {
  readonly command: string;
  readonly file_pattern?: string | undefined;
};

export interface DirtyBitsContract {
  readonly snapshot: (sid: SessionIdType) => Effect.Effect<ReadonlyArray<string>, DirtyBitsError>;
  readonly diff: (sid: SessionIdType) => Effect.Effect<ReadonlyArray<string>, DirtyBitsError>;
  readonly runOnAdvance: (
    sid: SessionIdType,
    phase: string,
    commands: ReadonlyArray<OnAdvanceCommand>,
    files: ReadonlyArray<string>,
  ) => Effect.Effect<void, DirtyBitsError>;
}

const parseGitOutput = (stdout: string): ReadonlyArray<string> =>
  pipe(
    stdout.split("\n"),
    Arr.map((l) => l.trim()),
    Arr.filter((l) => l !== ""),
  );

export class DirtyBits extends Context.Service<DirtyBits, DirtyBitsContract>()(
  "@anakmagang/DirtyBits",
) {
  static readonly layer = Layer.effect(
    DirtyBits,
    Effect.gen(function* () {
      const config = yield* Config;
      const eventLog = yield* EventLog;
      const spawner = yield* ChildProcessSpawner;

      const runGit = Effect.fn("DirtyBits.runGit")(function* (args: ReadonlyArray<string>) {
        return yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(
              ChildProcess.make("git", args, { cwd: config.root }),
            );
            const stdout = yield* Stream.mkString(Stream.decodeText(handle.stdout));
            const code = yield* handle.exitCode;
            if (code !== 0) {
              const stderr = yield* Stream.mkString(Stream.decodeText(handle.stderr));
              return yield* new DirtyBitsError({
                message: `git ${Arr.join(args, " ")} failed (exit ${code}): ${stderr.slice(0, 300)}`,
              });
            }
            return stdout;
          }),
        );
      });

      return DirtyBits.of({
        snapshot: Effect.fn("DirtyBits.snapshot")(function* (sid: SessionIdType) {
          const stdout = yield* runGit(["rev-parse", "--verify", "HEAD"]).pipe(
            Effect.andThen(() => runGit(["diff", "--name-only", "HEAD"])),
            Effect.orElseSucceed(() => ""),
          );
          const files = parseGitOutput(stdout);
          yield* eventLog
            .writeJson(sid, "dirty", "baseline", files, Schema.Array(Schema.String))
            .pipe(
              Effect.mapError(
                (e) => new DirtyBitsError({ message: `Failed to write baseline: ${e.message}` }),
              ),
            );
          return files;
        }),

        diff: Effect.fn("DirtyBits.diff")(function* (sid: SessionIdType) {
          const baseline = yield* eventLog
            .readJson(sid, "dirty", "baseline", Schema.Array(Schema.String))
            .pipe(Effect.orElseSucceed(() => undefined));
          const baselineSet = new Set(baseline ?? []);
          const stdout = yield* runGit(["rev-parse", "--verify", "HEAD"]).pipe(
            Effect.andThen(() => runGit(["diff", "--name-only", "HEAD"])),
            Effect.orElseSucceed(() => ""),
          );
          const current = parseGitOutput(stdout);
          return Arr.filter(current, (f) => !baselineSet.has(f));
        }),

        runOnAdvance: Effect.fn("DirtyBits.runOnAdvance")(function* (
          _sid: SessionIdType,
          phase: string,
          commands: ReadonlyArray<OnAdvanceCommand>,
          files: ReadonlyArray<string>,
        ) {
          if (files.length === 0) return;
          yield* Effect.forEach(commands, (cmd) =>
            Effect.gen(function* () {
              const pattern = cmd.file_pattern;
              const filtered = pattern
                ? Arr.filter(files, (f) => new RegExp(pattern).test(f))
                : files;
              if (filtered.length === 0) return;
              const joined = Arr.join(filtered, " ");
              const resolved = cmd.command.replaceAll("{dirty-files}", joined);
              const code = yield* spawner.exitCode(
                ChildProcess.make("sh", ["-c", resolved], { cwd: config.root }),
              );
              if (code !== 0) {
                yield* Effect.logWarning(
                  `on_advance command failed for phase ${phase}: ${resolved}`,
                );
              }
            }),
          );
        }),
      });
    }),
  ).pipe(Layer.provide(EventLog.bare));
}
