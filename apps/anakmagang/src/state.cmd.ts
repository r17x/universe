import { Argument, Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, Option, Order, Result, Schema, pipe } from "effect";
import { SessionId } from "./Ulid";
import { Config } from "./Config";
import { EventLog } from "./EventLog";
import { ConfigEventLogLayers } from "./Layers";
import { Output } from "./protocol.Output";
import { Document, Line, Record } from "./protocol.Emission";

const resolvePhaseLabel = (
  isDraft: boolean,
  active: boolean,
  rawPhase: string | undefined,
  initialPhase: string,
  terminalLabel: string,
): string => (isDraft ? "draft" : active ? (rawPhase ?? initialPhase) : terminalLabel);

const renderOptional = (value: Option.Option<string>): string =>
  Option.getOrElse(value, () => "none");

const SortMode = ["latest", "oldest", "active", "phase"] as const;

type SessionEntry = {
  readonly sid: string;
  readonly active: boolean;
  readonly isDraft: boolean;
  readonly size: Option.Option<string>;
  readonly task: Option.Option<string>;
  readonly phase: string;
  readonly phaseNumber: number;
};

const bySidDesc = Order.flip(Order.mapInput(Order.String, (e: SessionEntry) => e.sid));
const bySidAsc = Order.mapInput(Order.String, (e: SessionEntry) => e.sid);

const sortDispatch: {
  readonly [K in (typeof SortMode)[number]]: (
    entries: ReadonlyArray<SessionEntry>,
  ) => ReadonlyArray<SessionEntry>;
} = {
  latest: (entries) => Arr.sort(entries, bySidDesc),
  oldest: (entries) => Arr.sort(entries, bySidAsc),
  active: (entries) => {
    const [dones, actives] = Arr.partition(entries, (e) =>
      e.active ? Result.succeed(e) : Result.fail(e),
    );
    return pipe(Arr.sort(actives, bySidDesc), Arr.appendAll(Arr.sort(dones, bySidDesc)));
  },
  phase: (entries) => {
    const byPhaseDesc = Order.flip(
      Order.mapInput(Order.Number, (e: SessionEntry) => e.phaseNumber),
    );
    return Arr.sort(entries, Order.combine(byPhaseDesc, bySidDesc));
  },
};

const sortSessions = (
  entries: ReadonlyArray<SessionEntry>,
  mode: (typeof SortMode)[number],
): ReadonlyArray<SessionEntry> => sortDispatch[mode](entries);

const StateOutput = Schema.Struct({
  session: Schema.String,
  active: Schema.Boolean,
  current_task: Schema.String,
  current_phase: Schema.String,
  task_size: Schema.String,
  completed_phases: Schema.Array(Schema.String),
  reflections: Schema.Array(Schema.Struct({ phase: Schema.String, reflection: Schema.String })),
  observations: Schema.Array(Schema.String),
  artifacts: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      source: Schema.String,
      tags: Schema.Array(Schema.String),
      size: Schema.Number,
    }),
  ),
});

const StateLayers = ConfigEventLogLayers;

export const stateCommand = Command.make(
  "state",
  {
    sessionId: Argument.string("session-id").pipe(Argument.optional),
    sort: Flag.choice("sort", SortMode).pipe(
      Flag.withAlias("s"),
      Flag.withDefault("latest" as const),
    ),
    status: Flag.choice("status", ["active", "done", "draft"] as const).pipe(
      Flag.withAlias("S"),
      Flag.optional,
    ),
    size: Flag.choice("size", ["trivial", "small", "medium", "large"] as const).pipe(
      Flag.withAlias("z"),
      Flag.optional,
    ),
    phase: Flag.string("phase").pipe(Flag.withAlias("p"), Flag.optional),
    task: Flag.string("task").pipe(Flag.withAlias("t"), Flag.optional),
    limit: Flag.integer("limit").pipe(Flag.withAlias("n"), Flag.optional),
    sync: Flag.boolean("sync").pipe(Flag.optional),
  },
  ({
    sessionId,
    sort,
    status,
    size: filterSize,
    phase: filterPhase,
    task: filterTask,
    limit,
    sync,
  }) =>
    Effect.gen(function* () {
      const eventLog = yield* EventLog;
      const output = yield* Output;
      const config = yield* Config;
      const phaseToNumber: Record<string, number> = Object.fromEntries(
        config.phaseIds.map((id, i) => [id, i + 1]),
      );

      if (Option.isSome(sync) && sync.value) {
        if (Option.isNone(sessionId)) {
          const sessions = yield* eventLog.listSessions();
          yield* Effect.forEach(sessions, (sid) =>
            Effect.gen(function* () {
              const synced = yield* eventLog.syncArtifacts(sid);
              yield* output.emit(
                Record({
                  fields: [
                    ["session", sid],
                    ["synced", String(Arr.length(synced))],
                  ],
                }),
              );
            }),
          );
          return;
        }
        const synced = yield* eventLog.syncArtifacts(SessionId(sessionId.value));
        yield* Effect.forEach(synced, (a) =>
          output.emit(
            Record({
              fields: [
                ["action", "synced"],
                ["path", a.path],
                ["size", String(a.size)],
              ],
            }),
          ),
        );
      }

      if (Option.isNone(sessionId)) {
        const sessions = yield* eventLog.listSessions();
        if (Arr.length(sessions) === 0) {
          yield* output.emit(Line({ text: "No sessions found." }));
          return;
        }
        const enriched = yield* Effect.forEach(sessions, (sid) =>
          Effect.gen(function* () {
            const active = yield* eventLog.isActive(sid);
            const isDraft = yield* eventLog.isDraft(sid);
            const rawPhase = yield* eventLog.currentPhase(sid);
            const task = Option.fromUndefinedOr(yield* eventLog.lastTaskName(sid));
            const size = Option.fromUndefinedOr(yield* eventLog.taskSize(sid));
            const phase = resolvePhaseLabel(
              isDraft,
              active,
              rawPhase,
              config.initialPhase,
              config.terminalLabel,
            );
            const phaseNumber =
              rawPhase === undefined ? config.phaseIds.length : (phaseToNumber[rawPhase] ?? 1);
            return { sid, active, isDraft, size, task, phase, phaseNumber };
          }),
        );
        const sorted = sortSessions(enriched, sort);
        const filtered = Arr.filter(
          sorted,
          (e) =>
            (Option.isNone(status) ||
              (status.value === "active" && e.active && !e.isDraft) ||
              (status.value === "done" && !e.active) ||
              (status.value === "draft" && e.isDraft)) &&
            (Option.isNone(filterSize) ||
              Option.match(e.size, {
                onNone: () => false,
                onSome: (s) => s.toLowerCase() === filterSize.value,
              })) &&
            (Option.isNone(filterPhase) || e.phase === filterPhase.value) &&
            (Option.isNone(filterTask) ||
              Option.match(e.task, {
                onNone: () => false,
                onSome: (t) => t.toLowerCase().includes(filterTask.value.toLowerCase()),
              })),
        );
        const limited = Option.match(limit, {
          onNone: () => filtered,
          onSome: (n) => Arr.take(filtered, n),
        });
        yield* Effect.forEach(limited, (entry) => {
          const label = entry.active ? "ACTIVE" : "DONE";
          return output.emit(
            Record({
              fields: [
                ["session", entry.sid],
                ["status", label],
                ["task", renderOptional(entry.task)],
                ["phase", entry.phase],
              ],
            }),
          );
        });
        return;
      }

      const sid = SessionId(sessionId.value);
      const task = Option.fromUndefinedOr(yield* eventLog.currentTask(sid));
      const active = yield* eventLog.isActive(sid);
      const isDraft = yield* eventLog.isDraft(sid);
      const rawPhase = yield* eventLog.currentPhase(sid);
      const phase = resolvePhaseLabel(
        isDraft,
        active,
        rawPhase,
        config.initialPhase,
        config.terminalLabel,
      );
      const size = Option.fromUndefinedOr(yield* eventLog.taskSize(sid));
      const completed = yield* eventLog.completedPhases(sid);
      const reflections = yield* eventLog.reflections(sid);
      const observations = yield* eventLog.observations(sid);
      const artifacts = yield* eventLog.listArtifacts(sid);

      const state = {
        session: sid,
        active,
        current_task: renderOptional(task),
        current_phase: phase,
        task_size: renderOptional(size),
        completed_phases: completed,
        reflections: Arr.map(reflections, (r) => ({ phase: r.phase, reflection: r.reflection })),
        observations,
        artifacts: Arr.map(artifacts, (a) => ({
          path: a.path,
          source: a.source,
          tags: [...a.tags],
          size: a.size,
        })),
      };

      yield* output.emit(
        Document({
          content: Schema.encodeSync(Schema.fromJsonString(StateOutput))(state),
          mediaType: "json",
        }),
      );
    }).pipe(Effect.provide(StateLayers)),
);
