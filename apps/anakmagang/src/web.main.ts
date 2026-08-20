import {
  Array as Arr,
  Data,
  Effect,
  Equal,
  Match as M,
  Option,
  Schema as S,
  Schedule,
  Stream,
} from "effect";
import { Canvas, Command, Runtime, Subscription } from "foldkit";
import { inertHtml } from "foldkit/html";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { m } from "foldkit/message";
import { evo } from "foldkit/struct";

import { glyphRegistry } from "./web.image";
import { SessionId, SessionIdSchema } from "./Ulid";
import {
  ConfigSummary,
  DashboardStats,
  GraphResponse,
  PhaseInfo,
  ProjectInfo,
  type ProviderSession,
  SessionDetail,
  SessionSummary,
  TranscriptEntry,
} from "./web.rpc";
import { type GraphState, initGraphState, stepSimulation, graphShapes, hitTest } from "./web.graph";
import { WebClient, WebClientLive } from "./web.client";

// MODEL

type Route = Data.TaggedEnum<{
  Dashboard: {};
  Sessions: {};
  SessionDetail: { readonly id: SessionId };
  Config: {};
  Graph: {};
}>;
const Route = Data.taggedEnum<Route>();

const RouteSchema = S.Union([
  S.TaggedStruct("Dashboard", {}),
  S.TaggedStruct("Sessions", {}),
  S.TaggedStruct("SessionDetail", { id: SessionIdSchema }),
  S.TaggedStruct("Config", {}),
  S.TaggedStruct("Graph", {}),
]);

type RemoteData<A> = Data.TaggedEnum<{
  NotAsked: {};
  Loading: {};
  Success: { readonly data: A };
  Failure: { readonly error: string };
}>;

interface RemoteDataDef extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: RemoteData<this["A"]>;
}
const RD = Data.taggedEnum<RemoteDataDef>();

const RemoteDataSchema = <A>(schema: S.Schema<A>) =>
  S.Union([
    S.TaggedStruct("NotAsked", {}),
    S.TaggedStruct("Loading", {}),
    S.TaggedStruct("Success", { data: schema }),
    S.TaggedStruct("Failure", { error: S.String }),
  ]);

const Model = S.Struct({
  route: RouteSchema,
  sessions: RemoteDataSchema(S.Array(SessionSummary)),
  dashboardStats: RemoteDataSchema(DashboardStats),
  sessionDetail: RemoteDataSchema(SessionDetail),
  theme: S.Literals(["Dark", "Light"]),
  commandPaletteOpen: S.Boolean,
  density: S.String,
  sessionFilter: S.Literals(["all", "active", "completed"]),
  selectedSessionInList: S.OptionFromUndefinedOr(SessionIdSchema),
  selectedRowIndex: S.OptionFromUndefinedOr(S.Number),
  commandPaletteQuery: S.String,
  commandPaletteActiveIndex: S.Number,
  expandedPhaseIndex: S.OptionFromUndefinedOr(S.Number),
  expandedTranscriptTs: S.OptionFromUndefinedOr(S.String),
  phases: S.Array(PhaseInfo),
  heatmapPeriod: S.Literals(["7d", "1m", "3m", "1y"]),
  heatmapDateFilter: S.OptionFromUndefinedOr(S.String),
  providerMenuOpen: S.Boolean,
  expandedClusterIndex: S.OptionFromUndefinedOr(S.Number),
  liveTab: S.Literals(["timeline", "live"]),
  transcriptMessages: RemoteDataSchema(S.Array(TranscriptEntry)),
  faviconSvgs: S.Array(S.String),
  faviconIndex: S.Number,
  projectName: S.String,
  projects: S.Array(ProjectInfo),
  projectHoverOpen: S.Boolean,
  configSummary: RemoteDataSchema(ConfigSummary),
  graphState: S.NullOr(S.Unknown),
  graphError: S.OptionFromUndefinedOr(S.String),
  copiedText: S.OptionFromUndefinedOr(S.String),
});
type Model = typeof Model.Type;

// MESSAGE

const SucceededFetchSessions = m("SucceededFetchSessions", {
  sessions: S.Array(SessionSummary),
});
const FailedFetchSessions = m("FailedFetchSessions", { error: S.String });
const SucceededFetchDashboard = m("SucceededFetchDashboard", {
  stats: DashboardStats,
});
const FailedFetchDashboard = m("FailedFetchDashboard", { error: S.String });
const SucceededFetchSession = m("SucceededFetchSession", {
  detail: SessionDetail,
});
const FailedFetchSession = m("FailedFetchSession", { error: S.String });
const SucceededFetchPhases = m("SucceededFetchPhases", { phases: S.Array(PhaseInfo) });
const FailedFetchPhases = m("FailedFetchPhases", { error: S.String });
const Navigated = m("Navigated", { route: RouteSchema });
const ToggledTheme = m("ToggledTheme");
const ToggledCommandPalette = m("ToggledCommandPalette");
const CompletedPollTick = m("CompletedPollTick");
const CycledDensity = m("CycledDensity");
const FilteredSessions = m("FilteredSessions", {
  filter: S.Literals(["all", "active", "completed"]),
});
const SelectedSessionInList = m("SelectedSessionInList", { id: SessionIdSchema });
const PressedKey = m("PressedKey", { key: S.String });
const UpdatedCommandPaletteQuery = m("UpdatedCommandPaletteQuery", { query: S.String });
const ToggledPhaseDetail = m("ToggledPhaseDetail", { index: S.Number });
const ToggledTranscriptMsg = m("ToggledTranscriptMsg", { timestamp: S.String });
const HoveredPhase = m("HoveredPhase", { index: S.Number });
const HoveredCluster = m("HoveredCluster", { index: S.Number });
const LeftCluster = m("LeftCluster", {});
const IgnoredPaletteClick = m("IgnoredPaletteClick");
const SelectedHeatmapPeriod = m("SelectedHeatmapPeriod", {
  period: S.Literals(["7d", "1m", "3m", "1y"]),
});
const ClickedHeatmapCell = m("ClickedHeatmapCell", { date: S.String });
const ToggledProviderMenu = m("ToggledProviderMenu");
const ReceivedSseEvent = m("ReceivedSseEvent", { eventType: S.String, sessionId: S.String });
const SwitchedLiveTab = m("SwitchedLiveTab", { tab: S.Literals(["timeline", "live"]) });
const SucceededFetchTranscript = m("SucceededFetchTranscript", {
  messages: S.Array(TranscriptEntry),
});
const FailedFetchTranscript = m("FailedFetchTranscript", { error: S.String });
const LoadedGlyphs = m("LoadedGlyphs", { svgs: S.Array(S.String) });
const FailedLoadGlyphs = m("FailedLoadGlyphs", { error: S.String });
const FaviconSet = m("FaviconSet");
const DebouncedFetchSession = m("DebouncedFetchSession", { id: SessionIdSchema });
const SucceededFetchProjects = m("SucceededFetchProjects", { projects: S.Array(ProjectInfo) });
const FailedFetchProjects = m("FailedFetchProjects", { error: S.String });
const ToggledProjectHover = m("ToggledProjectHover", { open: S.Boolean });
const SelectedProject = m("SelectedProject", { id: S.String });
const SwitchedProject = m("SwitchedProject");
const FailedSwitchProject = m("FailedSwitchProject", { error: S.String });
const TitleSet = m("TitleSet", {});
const SucceededFetchConfig = m("SucceededFetchConfig", { config: ConfigSummary });
const FailedFetchConfig = m("FailedFetchConfig", { error: S.String });
const SucceededFetchGraph = m("SucceededFetchGraph", { data: GraphResponse });
const FailedFetchGraph = m("FailedFetchGraph", { error: S.String });
const TickedGraphFrame = m("TickedGraphFrame", { deltaTime: S.Number });
const PressedGraphCanvas = m("PressedGraphCanvas", { x: S.Number, y: S.Number });
const MovedGraphPointer = m("MovedGraphPointer", { x: S.Number, y: S.Number });
const ReleasedGraphPointer = m("ReleasedGraphPointer", { x: S.Number, y: S.Number });
const ClickedCopy = m("ClickedCopy", { text: S.String });
const SucceededCopy = m("SucceededCopy", { text: S.String });
const CompletedCopyFeedback = m("CompletedCopyFeedback");

const Message = S.Union([
  SucceededFetchSessions,
  FailedFetchSessions,
  SucceededFetchDashboard,
  FailedFetchDashboard,
  SucceededFetchSession,
  FailedFetchSession,
  SucceededFetchPhases,
  FailedFetchPhases,
  Navigated,
  ToggledTheme,
  ToggledCommandPalette,
  CompletedPollTick,
  CycledDensity,
  FilteredSessions,
  SelectedSessionInList,
  PressedKey,
  UpdatedCommandPaletteQuery,
  ToggledPhaseDetail,
  ToggledTranscriptMsg,
  HoveredPhase,
  HoveredCluster,
  LeftCluster,
  IgnoredPaletteClick,
  SelectedHeatmapPeriod,
  ClickedHeatmapCell,
  ToggledProviderMenu,
  ReceivedSseEvent,
  SwitchedLiveTab,
  SucceededFetchTranscript,
  FailedFetchTranscript,
  LoadedGlyphs,
  FailedLoadGlyphs,
  FaviconSet,
  DebouncedFetchSession,
  SucceededFetchProjects,
  FailedFetchProjects,
  ToggledProjectHover,
  SelectedProject,
  SwitchedProject,
  FailedSwitchProject,
  TitleSet,
  SucceededFetchConfig,
  FailedFetchConfig,
  SucceededFetchGraph,
  FailedFetchGraph,
  TickedGraphFrame,
  PressedGraphCanvas,
  MovedGraphPointer,
  ReleasedGraphPointer,
  ClickedCopy,
  SucceededCopy,
  CompletedCopyFeedback,
]);
type Message = typeof Message.Type;

// COMMAND

const FetchDashboard = Command.define("FetchDashboard", {
  messages: [SucceededFetchDashboard, FailedFetchDashboard],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const stats = yield* client.GetDashboard();
    return SucceededFetchDashboard({ stats });
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(FailedFetchDashboard({ error: "Failed to fetch dashboard" })),
    ),
  ),
});

const FetchSessions = Command.define("FetchSessions", {
  messages: [SucceededFetchSessions, FailedFetchSessions],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const sessions = yield* client.ListSessions();
    return SucceededFetchSessions({ sessions });
  }).pipe(
    Effect.catch(() => Effect.succeed(FailedFetchSessions({ error: "Failed to fetch sessions" }))),
  ),
});

const FetchSession = Command.define("FetchSession", {
  args: { id: SessionIdSchema },
  messages: [SucceededFetchSession, FailedFetchSession],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const client = yield* WebClient;
      const detail = yield* client.GetSession({ id });
      return SucceededFetchSession({ detail });
    }).pipe(
      Effect.catch(() => Effect.succeed(FailedFetchSession({ error: "Failed to fetch session" }))),
    ),
});

const FetchPhases = Command.define("FetchPhases", {
  messages: [SucceededFetchPhases, FailedFetchPhases],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const phases = yield* client.GetPhases();
    return SucceededFetchPhases({ phases });
  }).pipe(
    Effect.catch(() => Effect.succeed(FailedFetchPhases({ error: "Failed to fetch phases" }))),
  ),
});

const FetchTranscript = Command.define("FetchTranscript", {
  args: { sessionId: SessionIdSchema },
  messages: [SucceededFetchTranscript, FailedFetchTranscript],
  execute: ({ sessionId }) =>
    Effect.gen(function* () {
      const client = yield* WebClient;
      const messages = yield* client.GetTranscript({ sessionId });
      return SucceededFetchTranscript({ messages });
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(FailedFetchTranscript({ error: "Failed to fetch transcript" })),
      ),
    ),
});

const FetchAllGlyphs = Command.define("FetchAllGlyphs", {
  messages: [LoadedGlyphs, FailedLoadGlyphs],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const svgs = yield* client.GetGlyphs();
    const dataUrls = Arr.map(svgs, (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`);
    return LoadedGlyphs({ svgs: dataUrls });
  }).pipe(
    Effect.catch(() => Effect.succeed(FailedLoadGlyphs({ error: "Failed to fetch glyphs" }))),
  ),
});

const FetchProjects = Command.define("FetchProjects", {
  messages: [SucceededFetchProjects, FailedFetchProjects],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const projects = yield* client.ListProjects();
    return SucceededFetchProjects({ projects });
  }).pipe(
    Effect.catch(() => Effect.succeed(FailedFetchProjects({ error: "Failed to fetch projects" }))),
  ),
});

const FetchConfig = Command.define("FetchConfig", {
  messages: [SucceededFetchConfig, FailedFetchConfig],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const config = yield* client.GetConfig();
    return SucceededFetchConfig({ config });
  }).pipe(
    Effect.catch(() => Effect.succeed(FailedFetchConfig({ error: "Failed to fetch config" }))),
  ),
});

const FetchGraph = Command.define("FetchGraph", {
  messages: [SucceededFetchGraph, FailedFetchGraph],
  execute: Effect.gen(function* () {
    const client = yield* WebClient;
    const data = yield* client.GetGraph();
    return SucceededFetchGraph({ data });
  }).pipe(Effect.catch(() => Effect.succeed(FailedFetchGraph({ error: "Failed to fetch graph" })))),
});

const SwitchProject = Command.define("SwitchProject", {
  args: { id: S.String },
  messages: [SwitchedProject, FailedSwitchProject],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const client = yield* WebClient;
      yield* client.SetActiveProject({ id });
      return SwitchedProject();
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(FailedSwitchProject({ error: "Failed to switch project" })),
      ),
    ),
});

const CopyToClipboard = Command.define("CopyToClipboard", {
  args: { text: S.String },
  messages: [SucceededCopy, SucceededCopy],
  execute: ({ text }) =>
    Effect.gen(function* () {
      yield* Effect.promise(() => navigator.clipboard.writeText(text));
      return SucceededCopy({ text });
    }),
});

const isDetailStale = (model: Model): boolean =>
  Option.isSome(model.selectedSessionInList) &&
  RD.$is("Success")(model.sessionDetail) &&
  model.sessionDetail.data.id !== model.selectedSessionInList.value;

const isFaviconInternal = (msg: Message): boolean =>
  S.is(FaviconSet)(msg) ||
  S.is(LoadedGlyphs)(msg) ||
  S.is(FailedLoadGlyphs)(msg) ||
  S.is(DebouncedFetchSession)(msg) ||
  S.is(TitleSet)(msg) ||
  S.is(ClickedHeatmapCell)(msg) ||
  S.is(TickedGraphFrame)(msg) ||
  S.is(MovedGraphPointer)(msg) ||
  S.is(ClickedCopy)(msg) ||
  S.is(SucceededCopy)(msg) ||
  S.is(CompletedCopyFeedback)(msg);

// CONSTANTS

const DENSITIES = [
  "default",
  "compact",
  "dense",
  "minimal",
  "spacious",
  "loose",
  "readable",
  "large",
  "mono",
  "terminal",
] as const;

// INIT

const init = (): readonly [Model, ReadonlyArray<Command.Command<Message, never, WebClient>>] => [
  {
    route: Route.Dashboard(),
    sessions: RD.NotAsked(),
    dashboardStats: RD.Loading(),
    sessionDetail: RD.NotAsked(),
    theme: "Dark",
    commandPaletteOpen: false,
    density: "default",
    sessionFilter: "all",
    selectedSessionInList: Option.none(),
    selectedRowIndex: Option.none(),
    commandPaletteQuery: "",
    commandPaletteActiveIndex: 0,
    expandedPhaseIndex: Option.none(),
    expandedTranscriptTs: Option.none(),
    expandedClusterIndex: Option.none(),
    phases: [],
    heatmapPeriod: "1m",
    heatmapDateFilter: Option.none(),
    providerMenuOpen: false,
    liveTab: "timeline",
    transcriptMessages: RD.NotAsked(),
    faviconSvgs: [],
    faviconIndex: 0,
    projectName: "",
    projects: [],
    projectHoverOpen: false,
    configSummary: RD.NotAsked(),
    graphState: null,
    graphError: Option.none(),
    copiedText: Option.none(),
  },
  [FetchDashboard(), FetchSessions(), FetchPhases(), FetchAllGlyphs(), FetchProjects()],
];

// UPDATE

type UpdateReturn = readonly [Model, ReadonlyArray<Command.Command<Message, never, WebClient>>];
const withUpdateReturn = M.withReturnType<UpdateReturn>();

const nextDensity = (current: string): string => {
  const idx = DENSITIES.indexOf(current as (typeof DENSITIES)[number]);
  return DENSITIES[(idx + 1) % DENSITIES.length] ?? current;
};

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ulidToDate = (ulid: string): string => {
  const ts = Arr.reduce(
    Arr.range(0, 9),
    0,
    (acc, i) => acc * 32 + CROCKFORD.indexOf((ulid[i] ?? "").toUpperCase()),
  );
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getVisibleSessions = (model: Model): ReadonlyArray<typeof SessionSummary.Type> => {
  if (!RD.$is("Success")(model.sessions)) {
    return [];
  }
  const filtered = Arr.filter(model.sessions.data, (session) => {
    if (model.sessionFilter === "active" && !session.isActive) return false;
    if (model.sessionFilter === "completed" && session.isActive) return false;
    if (Option.isSome(model.heatmapDateFilter)) {
      const sessionDate = ulidToDate(session.id);
      if (sessionDate !== model.heatmapDateFilter.value) return false;
    }
    return true;
  });
  return Route.$is("Dashboard")(model.route) ? Arr.take(filtered, 5) : filtered;
};

const visibleRowCount = (model: Model): number => getVisibleSessions(model).length;

const getFilteredPaletteItems = (
  model: Model,
): ReadonlyArray<(typeof COMMAND_PALETTE_ITEMS)[number]> =>
  model.commandPaletteQuery.length > 0
    ? Arr.filter(COMMAND_PALETTE_ITEMS, (item) =>
        item.label.toLowerCase().includes(model.commandPaletteQuery.toLowerCase()),
      )
    : [...COMMAND_PALETTE_ITEMS];

const rawUpdate = (model: Model, message: Message): UpdateReturn =>
  M.value(message).pipe(
    withUpdateReturn,
    M.tagsExhaustive({
      SucceededFetchSessions: ({ sessions }) => [
        evo(model, {
          sessions: () => RD.Success({ data: sessions }),
        }),
        [],
      ],

      FailedFetchSessions: ({ error }) => [
        evo(model, {
          sessions: () => RD.Failure({ error }),
        }),
        [],
      ],

      SucceededFetchDashboard: ({ stats }) => [
        evo(model, {
          dashboardStats: () => RD.Success({ data: stats }),
        }),
        [],
      ],

      FailedFetchDashboard: ({ error }) => [
        evo(model, {
          dashboardStats: () => RD.Failure({ error }),
        }),
        [],
      ],

      SucceededFetchSession: ({ detail }) => {
        const isSelected = Option.match(model.selectedSessionInList, {
          onNone: () => true,
          onSome: (selected) => selected === detail.id,
        });
        if (!isSelected) return [model, []];
        return [
          evo(model, {
            sessionDetail: () => RD.Success({ data: detail }),
          }),
          [],
        ];
      },

      FailedFetchSession: ({ error }) => [
        evo(model, {
          sessionDetail: () => RD.Failure({ error }),
        }),
        [],
      ],

      SucceededFetchPhases: ({ phases }) => [evo(model, { phases: () => [...phases] }), []],

      FailedFetchPhases: () => [model, []],

      Navigated: ({ route }) =>
        Route.$match(route, {
          Dashboard: (): UpdateReturn => [
            evo(model, {
              route: () => Route.Dashboard(),
              dashboardStats: () => RD.Loading(),
              selectedRowIndex: () => Option.none(),
              commandPaletteOpen: () => false,
              expandedPhaseIndex: () => Option.none(),
              providerMenuOpen: () => false,
              selectedSessionInList: () => Option.none<SessionId>(),
              sessionDetail: () => RD.NotAsked(),
            }),
            [FetchDashboard()],
          ],
          Sessions: (): UpdateReturn => [
            evo(model, {
              route: () => Route.Sessions(),
              sessions: () => RD.Loading(),
              selectedRowIndex: () => Option.none(),
              commandPaletteOpen: () => false,
              expandedPhaseIndex: () => Option.none(),
              providerMenuOpen: () => false,
              selectedSessionInList: () => Option.none<SessionId>(),
              sessionDetail: () => RD.NotAsked(),
            }),
            [FetchSessions()],
          ],
          SessionDetail: ({ id }): UpdateReturn => [
            evo(model, {
              route: () => Route.SessionDetail({ id }),
              sessionDetail: () => RD.Loading(),
              selectedSessionInList: () => Option.some(id),
              sessions: () => RD.Loading(),
              selectedRowIndex: () => Option.none(),
              expandedPhaseIndex: () => Option.none(),
              expandedTranscriptTs: () => Option.none(),
              providerMenuOpen: () => false,
              liveTab: () => "timeline" as const,
              transcriptMessages: () => RD.NotAsked(),
            }),
            [FetchSession({ id }), FetchSessions()],
          ],
          Config: (): UpdateReturn => [
            evo(model, {
              route: () => Route.Config(),
              configSummary: () => RD.Loading(),
              commandPaletteOpen: () => false,
              providerMenuOpen: () => false,
            }),
            [FetchConfig()],
          ],
          Graph: (): UpdateReturn => [
            evo(model, {
              route: () => Route.Graph(),
              commandPaletteOpen: () => false,
              providerMenuOpen: () => false,
              graphState: () => null,
              graphError: () => Option.none(),
            }),
            [FetchGraph()],
          ],
        }),

      ToggledTheme: () => [
        evo(model, {
          theme: (current) => (current === "Dark" ? ("Light" as const) : ("Dark" as const)),
        }),
        [],
      ],

      ToggledCommandPalette: () => [
        evo(model, {
          commandPaletteOpen: (open) => !open,
          commandPaletteActiveIndex: () => 0,
        }),
        [],
      ],

      CycledDensity: () => [
        evo(model, {
          density: (current) => nextDensity(current),
        }),
        [],
      ],

      FilteredSessions: ({ filter }) => [
        evo(model, {
          sessionFilter: () => filter,
        }),
        [],
      ],

      SelectedSessionInList: ({ id }) => {
        const isSame =
          Option.isSome(model.selectedSessionInList) && model.selectedSessionInList.value === id;
        if (isSame) {
          return [
            evo(model, {
              selectedSessionInList: () => Option.none<SessionId>(),
            }),
            [],
          ];
        }
        return [
          evo(model, {
            selectedSessionInList: () => Option.some(id),
            sessionDetail: () => RD.Loading(),
            liveTab: () => "timeline" as const,
          }),
          [],
        ];
      },

      CompletedPollTick: () =>
        M.value(model.route).pipe(
          withUpdateReturn,
          M.tagsExhaustive({
            Dashboard: () => [model, [FetchDashboard(), FetchProjects()]],
            Sessions: () => {
              const cmds: Array<Command.Command<Message, never, WebClient>> = [
                FetchSessions(),
                FetchProjects(),
              ];
              if (Option.isSome(model.selectedSessionInList)) {
                cmds.push(FetchSession({ id: model.selectedSessionInList.value }));
              }
              return [model, cmds];
            },
            SessionDetail: ({ id }) => [model, [FetchSession({ id }), FetchProjects()]],
            Config: () => [model, [FetchConfig(), FetchProjects()]],
            Graph: () => [model, [FetchGraph(), FetchProjects()]],
          }),
        ),

      ReceivedSseEvent: ({ eventType }) =>
        M.value(model.route).pipe(
          withUpdateReturn,
          M.tagsExhaustive({
            Dashboard: () => {
              const cmds: Array<Command.Command<Message, never, WebClient>> = [FetchDashboard()];
              if (eventType === "project_registered") cmds.push(FetchProjects());
              return [model, cmds];
            },
            Sessions: () => {
              const cmds: Array<Command.Command<Message, never, WebClient>> = [FetchSessions()];
              if (Option.isSome(model.selectedSessionInList)) {
                cmds.push(FetchSession({ id: model.selectedSessionInList.value }));
              }
              if (eventType === "project_registered") cmds.push(FetchProjects());
              return [model, cmds];
            },
            SessionDetail: ({ id }) => {
              const cmds: Array<Command.Command<Message, never, WebClient>> = [
                FetchSession({ id }),
              ];
              if (eventType === "transcript" && model.liveTab === "live") {
                cmds.push(FetchTranscript({ sessionId: id }));
              }
              if (eventType === "project_registered") cmds.push(FetchProjects());
              return [model, cmds];
            },
            Config: () => {
              const cmds: Array<Command.Command<Message, never, WebClient>> = [FetchConfig()];
              if (eventType === "project_registered") cmds.push(FetchProjects());
              return [model, cmds];
            },
            Graph: () => {
              const cmds: Array<Command.Command<Message, never, WebClient>> = [];
              if (eventType === "project_registered") cmds.push(FetchProjects());
              return [model, cmds];
            },
          }),
        ),

      PressedKey: ({ key }) =>
        M.value(key).pipe(
          withUpdateReturn,
          M.when("/", () => {
            if (model.commandPaletteOpen) {
              return [model, []];
            }
            return [
              evo(model, {
                commandPaletteOpen: () => true,
                commandPaletteQuery: () => "",
              }),
              [],
            ];
          }),
          M.when("Escape", () => {
            if (model.providerMenuOpen) {
              return [evo(model, { providerMenuOpen: () => false }), []];
            }
            if (model.commandPaletteOpen) {
              return [evo(model, { commandPaletteOpen: () => false }), []];
            }
            if (Option.isSome(model.selectedRowIndex)) {
              return [evo(model, { selectedRowIndex: () => Option.none() }), []];
            }
            return [model, []];
          }),
          M.when("+", () => {
            const gs = model.graphState as GraphState | null;
            if (!gs) return [model, []];
            return [
              evo(model, {
                graphState: () => ({
                  ...gs,
                  camera: { ...gs.camera, zoom: Math.min(gs.camera.zoom * 1.2, 5) },
                }),
              }),
              [],
            ];
          }),
          M.when("=", () => {
            const gs = model.graphState as GraphState | null;
            if (!gs) return [model, []];
            return [
              evo(model, {
                graphState: () => ({
                  ...gs,
                  camera: { ...gs.camera, zoom: Math.min(gs.camera.zoom * 1.2, 5) },
                }),
              }),
              [],
            ];
          }),
          M.when("-", () => {
            const gs = model.graphState as GraphState | null;
            if (!gs) return [model, []];
            return [
              evo(model, {
                graphState: () => ({
                  ...gs,
                  camera: { ...gs.camera, zoom: Math.max(gs.camera.zoom / 1.2, 0.1) },
                }),
              }),
              [],
            ];
          }),
          M.when("0", () => {
            const gs = model.graphState as GraphState | null;
            if (!gs) return [model, []];
            return [
              evo(model, { graphState: () => ({ ...gs, camera: { x: 0, y: 0, zoom: 1 } }) }),
              [],
            ];
          }),
          M.when("j", () => {
            const maxIndex = visibleRowCount(model) - 1;
            if (maxIndex < 0) {
              return [model, []];
            }
            const newIndex = Math.min(
              Option.getOrElse(model.selectedRowIndex, () => -1) + 1,
              maxIndex,
            );
            const sessions = getVisibleSessions(model);
            const maybeSession = Arr.get(sessions, newIndex);
            if (Option.isSome(maybeSession)) {
              return [
                evo(model, {
                  selectedRowIndex: () => Option.some(newIndex),
                  selectedSessionInList: () => Option.some(maybeSession.value.id),
                  liveTab: () => "timeline" as const,
                }),
                [],
              ];
            }
            return [
              evo(model, {
                selectedRowIndex: () => Option.some(newIndex),
              }),
              [],
            ];
          }),
          M.when("k", () => {
            const newIndex = Math.max(Option.getOrElse(model.selectedRowIndex, () => 1) - 1, 0);
            const sessions = getVisibleSessions(model);
            const maybeSession = Arr.get(sessions, newIndex);
            if (Option.isSome(maybeSession)) {
              return [
                evo(model, {
                  selectedRowIndex: () => Option.some(newIndex),
                  selectedSessionInList: () => Option.some(maybeSession.value.id),
                  liveTab: () => "timeline" as const,
                }),
                [],
              ];
            }
            return [
              evo(model, {
                selectedRowIndex: () => Option.some(newIndex),
              }),
              [],
            ];
          }),
          M.when("ArrowDown", () => {
            if (!model.commandPaletteOpen) {
              return [model, []];
            }
            const filtered = getFilteredPaletteItems(model);
            const maxIdx = filtered.length - 1;
            return [
              evo(model, {
                commandPaletteActiveIndex: (current) => Math.min(current + 1, maxIdx),
              }),
              [],
            ];
          }),
          M.when("ArrowUp", () => {
            if (!model.commandPaletteOpen) {
              return [model, []];
            }
            return [
              evo(model, {
                commandPaletteActiveIndex: (current) => Math.max(current - 1, 0),
              }),
              [],
            ];
          }),
          M.when("Enter", () => {
            if (model.commandPaletteOpen) {
              const filtered = getFilteredPaletteItems(model);
              const maybeItem = Arr.get(filtered, model.commandPaletteActiveIndex);
              if (Option.isNone(maybeItem)) {
                return [model, []];
              }
              const navMessage =
                maybeItem.value.section === "Dashboard"
                  ? Navigated({ route: Route.Dashboard() })
                  : maybeItem.value.section === "Config"
                    ? Navigated({ route: Route.Config() })
                    : maybeItem.value.section === "Graph"
                      ? Navigated({ route: Route.Graph() })
                      : Navigated({ route: Route.Sessions() });
              return update(model, navMessage);
            }
            if (Option.isNone(model.selectedRowIndex)) {
              return [model, []];
            }
            const sessions = getVisibleSessions(model);
            const maybeSession = Arr.get(sessions, model.selectedRowIndex.value);
            if (Option.isNone(maybeSession)) {
              return [model, []];
            }
            if (Route.$is("Dashboard")(model.route)) {
              return update(
                model,
                Navigated({ route: Route.SessionDetail({ id: maybeSession.value.id }) }),
              );
            }
            return update(model, SelectedSessionInList({ id: maybeSession.value.id }));
          }),
          M.orElse(() => [model, []]),
        ),

      UpdatedCommandPaletteQuery: ({ query }) => [
        evo(model, {
          commandPaletteQuery: () => query,
          commandPaletteActiveIndex: () => 0,
        }),
        [],
      ],

      IgnoredPaletteClick: () => [model, []],

      SelectedHeatmapPeriod: ({ period }) => [
        evo(model, { heatmapPeriod: () => period, heatmapDateFilter: () => Option.none() }),
        [],
      ],

      ClickedHeatmapCell: ({ date }) => [
        evo(model, {
          heatmapDateFilter: (current) =>
            Option.isSome(current) && current.value === date ? Option.none() : Option.some(date),
        }),
        [],
      ],

      ToggledProviderMenu: () => [evo(model, { providerMenuOpen: (open) => !open }), []],

      ToggledPhaseDetail: ({ index }) => [
        evo(model, {
          expandedPhaseIndex: (current) =>
            Option.exists(current, Equal.equals(index)) ? Option.none() : Option.some(index),
        }),
        [],
      ],

      ToggledTranscriptMsg: ({ timestamp }) => [
        evo(model, {
          expandedTranscriptTs: (current) =>
            Option.exists(current, Equal.equals(timestamp))
              ? Option.none()
              : Option.some(timestamp),
        }),
        [],
      ],

      HoveredPhase: ({ index }) => [
        evo(model, {
          expandedPhaseIndex: () => Option.some(index),
        }),
        [],
      ],

      HoveredCluster: ({ index }) => [
        evo(model, {
          expandedClusterIndex: () => Option.some(index),
        }),
        [],
      ],

      LeftCluster: () => [
        evo(model, {
          expandedClusterIndex: () => Option.none(),
        }),
        [],
      ],

      SwitchedLiveTab: ({ tab }) => {
        if (tab === "live") {
          if (Option.isSome(model.selectedSessionInList)) {
            return [
              evo(model, {
                liveTab: () => tab,
                transcriptMessages: () => RD.Loading(),
                expandedTranscriptTs: () => Option.none(),
              }),
              [FetchTranscript({ sessionId: model.selectedSessionInList.value })],
            ];
          }
          if (Route.$is("SessionDetail")(model.route)) {
            return [
              evo(model, {
                liveTab: () => tab,
                transcriptMessages: () => RD.Loading(),
                expandedTranscriptTs: () => Option.none(),
              }),
              [FetchTranscript({ sessionId: model.route.id })],
            ];
          }
        }
        return [evo(model, { liveTab: () => tab, expandedTranscriptTs: () => Option.none() }), []];
      },

      SucceededFetchTranscript: ({ messages }) => [
        evo(model, { transcriptMessages: () => RD.Success({ data: [...messages] }) }),
        [],
      ],

      FailedFetchTranscript: ({ error }) => [
        evo(model, { transcriptMessages: () => RD.Failure({ error }) }),
        [],
      ],

      LoadedGlyphs: ({ svgs }) => [evo(model, { faviconSvgs: () => [...svgs] }), []],

      FailedLoadGlyphs: () => [model, []],

      FaviconSet: () => [model, []],

      TitleSet: () => [model, []],

      DebouncedFetchSession: ({ id }) => [model, [FetchSession({ id })]],

      SucceededFetchProjects: ({ projects }) => {
        const active = Arr.findFirst(projects, (p) => p.isActive);
        return [
          evo(model, {
            projects: () => [...projects],
            projectName: () => (Option.isSome(active) ? active.value.name : model.projectName),
          }),
          [],
        ];
      },

      FailedFetchProjects: () => [model, []],

      ToggledProjectHover: ({ open }) => [evo(model, { projectHoverOpen: () => open }), []],

      SelectedProject: ({ id }) => {
        const selected = Arr.findFirst(model.projects, (p) => p.id === id);
        return [
          evo(model, {
            projectHoverOpen: () => false,
            dashboardStats: () => RD.Loading(),
            sessions: () => RD.Loading(),
            projectName: () => (Option.isSome(selected) ? selected.value.name : model.projectName),
          }),
          [SwitchProject({ id })],
        ];
      },

      SwitchedProject: () => [
        model,
        [FetchDashboard(), FetchSessions(), FetchPhases(), FetchProjects(), FetchConfig()],
      ],

      FailedSwitchProject: () => [
        evo(model, {
          dashboardStats: () => RD.Failure({ error: "Failed to switch project" }),
          sessions: () => RD.Failure({ error: "Failed to switch project" }),
        }),
        [],
      ],

      SucceededFetchConfig: ({ config }) => [
        evo(model, { configSummary: () => RD.Success({ data: config }) }),
        [],
      ],

      FailedFetchConfig: ({ error }) => [
        evo(model, { configSummary: () => RD.Failure({ error }) }),
        [],
      ],

      SucceededFetchGraph: ({ data }) => [
        evo(model, {
          graphState: () => initGraphState(data),
          graphError: () => Option.none(),
        }),
        [],
      ],

      FailedFetchGraph: ({ error }) => [evo(model, { graphError: () => Option.some(error) }), []],

      TickedGraphFrame: ({ deltaTime }) => {
        const gs = model.graphState as GraphState | null;
        if (!gs || !gs.isSimulating) return [model, []];
        return [
          evo(model, {
            graphState: () => stepSimulation(gs, deltaTime),
          }),
          [],
        ];
      },

      PressedGraphCanvas: ({ x, y }) => {
        const gs = model.graphState as GraphState | null;
        if (!gs) return [model, []];
        const w = window.innerWidth;
        const gh = window.innerHeight - 76;
        const nodeId = hitTest(gs, x, y, w, gh);
        const now = Date.now();
        const isDoubleClick =
          nodeId !== null && nodeId === gs.lastClickNodeId && now - gs.lastClickTime < 400;

        if (isDoubleClick && nodeId.startsWith("s:")) {
          return update(
            model,
            Navigated({ route: Route.SessionDetail({ id: SessionId(nodeId.slice(2)) }) }),
          );
        }

        if (nodeId) {
          const simNode = gs.simNodes.find((sn) => sn.node.id === nodeId);
          if (simNode) {
            const graphX = (x - w / 2 - gs.camera.x) / gs.camera.zoom;
            const graphY = (y - gh / 2 - gs.camera.y) / gs.camera.zoom;
            return [
              evo(model, {
                graphState: () => ({
                  ...gs,
                  interaction: {
                    _tag: "Dragging" as const,
                    nodeId,
                    offsetX: simNode.x - graphX,
                    offsetY: simNode.y - graphY,
                  },
                  simNodes: gs.simNodes.map((sn) =>
                    sn.node.id === nodeId ? { ...sn, pinned: true } : sn,
                  ),
                  isSimulating: false,
                  lastClickTime: now,
                  lastClickNodeId: nodeId,
                }),
              }),
              [],
            ];
          }
        }
        return [
          evo(model, {
            graphState: () => ({
              ...gs,
              interaction: {
                _tag: "Panning" as const,
                startX: x,
                startY: y,
                cameraStartX: gs.camera.x,
                cameraStartY: gs.camera.y,
              },
              lastClickTime: now,
              lastClickNodeId: nodeId,
            }),
          }),
          [],
        ];
      },

      MovedGraphPointer: ({ x, y }) => {
        const gs = model.graphState as GraphState | null;
        if (!gs) return [model, []];
        if (gs.interaction._tag === "Dragging") {
          const dragging = gs.interaction;
          const graphX = (x - window.innerWidth / 2 - gs.camera.x) / gs.camera.zoom;
          const graphY = (y - (window.innerHeight - 76) / 2 - gs.camera.y) / gs.camera.zoom;
          return [
            evo(model, {
              graphState: () => ({
                ...gs,
                simNodes: gs.simNodes.map((sn) =>
                  sn.node.id === dragging.nodeId
                    ? { ...sn, x: graphX + dragging.offsetX, y: graphY + dragging.offsetY }
                    : sn,
                ),
              }),
            }),
            [],
          ];
        }
        if (gs.interaction._tag === "Panning") {
          const panning = gs.interaction;
          const dx = x - panning.startX;
          const dy = y - panning.startY;
          return [
            evo(model, {
              graphState: () => ({
                ...gs,
                camera: {
                  ...gs.camera,
                  x: panning.cameraStartX + dx,
                  y: panning.cameraStartY + dy,
                },
              }),
            }),
            [],
          ];
        }
        const hoveredNodeId = hitTest(gs, x, y, window.innerWidth, window.innerHeight - 76);
        if (hoveredNodeId !== gs.hoveredNodeId) {
          return [
            evo(model, {
              graphState: () => ({ ...gs, hoveredNodeId }),
            }),
            [],
          ];
        }
        return [model, []];
      },

      ClickedCopy: ({ text }): UpdateReturn => [model, [CopyToClipboard({ text })]],

      SucceededCopy: ({ text }): UpdateReturn => [
        evo(model, { copiedText: () => Option.some(text) }),
        [],
      ],

      CompletedCopyFeedback: (): UpdateReturn => [
        evo(model, { copiedText: () => Option.none() }),
        [],
      ],

      ReleasedGraphPointer: () => {
        const gs = model.graphState as GraphState | null;
        if (!gs) return [model, []];
        if (gs.interaction._tag === "Dragging") {
          const dragging = gs.interaction;
          return [
            evo(model, {
              graphState: () => ({
                ...gs,
                interaction: { _tag: "Idle" as const },
                simNodes: gs.simNodes.map((sn) =>
                  sn.node.id === dragging.nodeId ? { ...sn, pinned: false } : sn,
                ),
                isSimulating: false,
              }),
            }),
            [],
          ];
        }
        return [
          evo(model, {
            graphState: () => ({ ...gs, interaction: { _tag: "Idle" as const } }),
          }),
          [],
        ];
      },
    }),
  );

const withFaviconCycle =
  (message: Message) =>
  ([model, cmds]: UpdateReturn): UpdateReturn => {
    if (model.faviconSvgs.length === 0 || isFaviconInternal(message)) return [model, cmds];
    return [evo(model, { faviconIndex: (i) => (i + 1) % model.faviconSvgs.length }), cmds];
  };

const update = (model: Model, message: Message): UpdateReturn =>
  withFaviconCycle(message)(rawUpdate(model, message));

// SUBSCRIPTION

const handleKeyboardEvent = (event: KeyboardEvent): Effect.Effect<Option.Option<Message>> =>
  Effect.sync(() => {
    const tag = (event.target as HTMLElement)?.tagName;
    const inInput = tag === "INPUT" || tag === "TEXTAREA";

    if (event.key === "Escape") {
      event.preventDefault();
      return Option.some(PressedKey({ key: "Escape" }));
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      return Option.some(PressedKey({ key: event.key }));
    }
    if (inInput) {
      return Option.none();
    }

    if (event.key === "/" || event.key === "j" || event.key === "k" || event.key === "Enter") {
      event.preventDefault();
      return Option.some(PressedKey({ key: event.key }));
    }
    return Option.none();
  });

const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  polling: entry(
    { polling: S.String },
    {
      modelToDependencies: (model) => ({
        polling: Route.$match(model.route, {
          Dashboard: () => "Dashboard",
          Sessions: () => "Sessions",
          SessionDetail: ({ id }) => `SessionDetail:${id}`,
          Config: () => "Config",
          Graph: () => "Graph",
        }),
      }),
      dependenciesToStream: () =>
        Stream.schedule(Stream.make(null), Schedule.spaced("30 seconds")).pipe(
          Stream.map(() => CompletedPollTick()),
        ),
    },
  ),

  keyboard: entry(
    { keyboard: S.Null },
    {
      modelToDependencies: () => ({ keyboard: null }),
      dependenciesToStream: () =>
        Stream.fromEventListener<KeyboardEvent>(document, "keydown").pipe(
          Stream.mapEffect(handleKeyboardEvent),
          Stream.filter(Option.isSome),
          Stream.map((option) => option.value),
        ),
    },
  ),

  sse: entry(
    { sse: S.Null },
    {
      modelToDependencies: () => ({ sse: null }),
      dependenciesToStream: () => {
        const es = new EventSource("/events");
        const eventTypes = [
          "guard_fired",
          "phase_advanced",
          "observed",
          "session_started",
          "session_completed",
          "file_changed",
          "transcript",
          "project_registered",
        ] as const;
        return Stream.mergeAll(
          Arr.map(eventTypes, (eventType) => Stream.fromEventListener<MessageEvent>(es, eventType)),
          { concurrency: eventTypes.length },
        ).pipe(
          Stream.map((event) => {
            const sessionId = S.decodeUnknownOption(
              S.fromJsonString(S.Struct({ sessionId: S.optional(S.String) })),
            )(event.data).pipe(
              Option.map((d) => d.sessionId ?? ""),
              Option.getOrElse(() => ""),
            );
            return ReceivedSseEvent({ eventType: event.type, sessionId });
          }),
        );
      },
    },
  ),

  favicon: entry(
    { favicon: S.NullOr(S.String) },
    {
      modelToDependencies: (model) => ({
        favicon:
          model.faviconSvgs.length > 0 ? (model.faviconSvgs[model.faviconIndex] ?? null) : null,
      }),
      dependenciesToStream: ({ favicon: dataUrl }) => {
        if (dataUrl === null) return Stream.empty;
        return Stream.fromEffect(
          Effect.sync(() => {
            const link = document.querySelector<HTMLLinkElement>("#favicon");
            if (link) link.href = dataUrl;
            return FaviconSet();
          }),
        );
      },
    },
  ),

  documentTitle: entry(
    { documentTitle: S.String },
    {
      modelToDependencies: (model) => ({
        documentTitle: Route.$match(model.route, {
          Dashboard: () => "anakmagang",
          Sessions: () => "sessions \u00b7 anakmagang",
          SessionDetail: () =>
            RD.$is("Success")(model.sessionDetail)
              ? `${model.sessionDetail.data.task} \u00b7 anakmagang`
              : "session \u00b7 anakmagang",
          Config: () => "config \u00b7 anakmagang",
          Graph: () => "graph \u00b7 anakmagang",
        }),
      }),
      dependenciesToStream: ({ documentTitle: title }) =>
        Stream.fromEffect(
          Effect.sync(() => {
            document.title = title;
            return TitleSet();
          }),
        ),
    },
  ),

  sessionFetch: entry(
    { sessionFetch: S.NullOr(SessionIdSchema) },
    {
      modelToDependencies: (model) => ({
        sessionFetch: Option.getOrNull(model.selectedSessionInList),
      }),
      dependenciesToStream: ({ sessionFetch: id }) => {
        if (id === null) return Stream.empty;
        return Stream.fromEffect(
          Effect.sleep("150 millis").pipe(Effect.as(DebouncedFetchSession({ id }))),
        );
      },
    },
  ),

  copyFeedback: entry(
    { copyFeedback: S.NullOr(S.String) },
    {
      modelToDependencies: (model) => ({ copyFeedback: Option.getOrNull(model.copiedText) }),
      dependenciesToStream: ({ copyFeedback: text }) => {
        if (text === null) return Stream.empty;
        return Stream.fromEffect(
          Effect.delay(Effect.succeed(CompletedCopyFeedback()), "1.5 seconds"),
        );
      },
    },
  ),

  graphFrame: Subscription.animationFrame<Model, Message>({
    isActive: (model) => {
      const gs = model.graphState as GraphState | null;
      return gs !== null && gs.isSimulating;
    },
    toMessage: (deltaTime) => TickedGraphFrame({ deltaTime }),
  }),
}));

// VIEW HELPERS

const ih = inertHtml;

const withHtmlReturn = M.withReturnType<Html>();

const phaseStatus = (
  phaseName: string,
  completedPhases: ReadonlyArray<string>,
  currentPhase: string,
  activePhases: ReadonlyArray<string>,
): string => {
  if (completedPhases.includes(phaseName)) return "completed";
  if (phaseName === currentPhase) return "active";
  if (!activePhases.includes(phaseName)) return "skipped";
  return "pending";
};

const skeletonLine = (cls: string): Html => ih.div([ih.Class(`skeleton ${cls}`)], []);

const dashboardBodySkeleton: Html = ih.div(
  [],
  [
    ih.div(
      [ih.Class("stat-row")],
      [
        ih.div(
          [ih.Class("skeleton-stat-card")],
          [
            skeletonLine("skeleton-line-sm"),
            skeletonLine("skeleton-value"),
            skeletonLine("skeleton-bar"),
          ],
        ),
        ih.div(
          [ih.Class("skeleton-stat-card")],
          [
            skeletonLine("skeleton-line-sm"),
            skeletonLine("skeleton-value"),
            skeletonLine("skeleton-bar"),
          ],
        ),
        ih.div(
          [ih.Class("skeleton-stat-card")],
          [
            skeletonLine("skeleton-line-sm"),
            skeletonLine("skeleton-value"),
            skeletonLine("skeleton-bar"),
          ],
        ),
        ih.div(
          [ih.Class("skeleton-stat-card")],
          [
            skeletonLine("skeleton-line-sm"),
            skeletonLine("skeleton-value"),
            skeletonLine("skeleton-bar"),
          ],
        ),
      ],
    ),
    ih.div([ih.Class("skeleton skeleton-heatmap")], []),
    ih.div(
      [],
      [
        ih.div(
          [ih.Class("skeleton-table-row")],
          [
            ih.div([ih.Class("skeleton skeleton-badge")], []),
            ih.div([ih.Class("skeleton skeleton-cell-task")], []),
            ih.div([ih.Class("skeleton skeleton-cell-phase")], []),
            ih.div([ih.Class("skeleton skeleton-cell-size")], []),
          ],
        ),
        ih.div(
          [ih.Class("skeleton-table-row")],
          [
            ih.div([ih.Class("skeleton skeleton-badge")], []),
            ih.div([ih.Class("skeleton skeleton-cell-task")], []),
            ih.div([ih.Class("skeleton skeleton-cell-phase")], []),
            ih.div([ih.Class("skeleton skeleton-cell-size")], []),
          ],
        ),
        ih.div(
          [ih.Class("skeleton-table-row")],
          [
            ih.div([ih.Class("skeleton skeleton-badge")], []),
            ih.div([ih.Class("skeleton skeleton-cell-task")], []),
            ih.div([ih.Class("skeleton skeleton-cell-phase")], []),
            ih.div([ih.Class("skeleton skeleton-cell-size")], []),
          ],
        ),
      ],
    ),
  ],
);

const sessionsSkeleton: Html = ih.div(
  [ih.Class("view-container")],
  [
    ih.div([ih.Class("view-header")], [skeletonLine("skeleton-line-sm")]),
    ih.div(
      [],
      Arr.map(Arr.range(0, 4), () =>
        ih.div(
          [ih.Class("skeleton-table-row")],
          [
            ih.div([ih.Class("skeleton skeleton-badge")], []),
            ih.div([ih.Class("skeleton skeleton-cell-task")], []),
            ih.div([ih.Class("skeleton skeleton-cell-phase")], []),
            ih.div([ih.Class("skeleton skeleton-cell-size")], []),
          ],
        ),
      ),
    ),
  ],
);

const transcriptSkeleton: ReadonlyArray<Html> = Arr.map(Arr.range(0, 3), () =>
  ih.div(
    [ih.Class("skeleton-transcript-msg")],
    [
      skeletonLine("skeleton-line-sm"),
      skeletonLine("skeleton-line-lg"),
      skeletonLine("skeleton-line-md"),
    ],
  ),
);

const sessionDetailSkeleton: Html = ih.div(
  [ih.Class("session-detail-inline")],
  [
    ih.div([ih.Class("skeleton skeleton-phase-bar")], []),
    ih.div(
      [ih.Class("skeleton-reflection")],
      [skeletonLine("skeleton-line-lg"), skeletonLine("skeleton-line-md")],
    ),
    ih.div(
      [ih.Class("skeleton-reflection")],
      [skeletonLine("skeleton-line-md"), skeletonLine("skeleton-line-sm")],
    ),
  ],
);

const errorView = (label: string, error: string): Html =>
  ih.div(
    [ih.Class("view-container")],
    [
      ih.div([ih.Class("view-header")], [`${label} Error`]),
      ih.p([ih.Class("error-message")], [error]),
    ],
  );

const buildHeatmapWeeks = (
  heatmap: ReadonlyArray<{ date: string; count: number; level: number }>,
  period: "7d" | "1m" | "3m" | "1y",
): ReadonlyArray<ReadonlyArray<{ level: number; date: string | null }>> => {
  const dayCount = period === "7d" ? 7 : period === "1m" ? 30 : period === "3m" ? 90 : 365;
  const entries = heatmap.slice(-dayCount);
  if (entries.length === 0)
    return [
      [
        { level: 0, date: null },
        { level: 0, date: null },
        { level: 0, date: null },
        { level: 0, date: null },
        { level: 0, date: null },
        { level: 0, date: null },
        { level: 0, date: null },
      ],
    ];
  const firstEntry = entries[0];
  if (!firstEntry) return [[]];
  const firstDate = new Date(firstEntry.date + "T00:00:00");
  const firstDow = firstDate.getDay();
  const emptyCell = { level: 0, date: null as string | null };
  const leadPad = firstDow > 0 ? Arr.makeBy(firstDow, () => emptyCell) : [];
  const allCells = [
    ...leadPad,
    ...Arr.map(entries, (e) => ({ level: e.level, date: e.date as string | null })),
  ];
  const trailCount = (7 - (allCells.length % 7)) % 7;
  const padded = [...allCells, ...(trailCount > 0 ? Arr.makeBy(trailCount, () => emptyCell) : [])];
  const weeks = Arr.chunksOf(padded, 7);
  const minWeeks = 53;
  const emptyWeek = Arr.makeBy(7, () => emptyCell);
  const prePadCount = Math.max(0, minWeeks - weeks.length);
  const prePad = prePadCount > 0 ? Arr.makeBy(prePadCount, () => emptyWeek) : [];
  return [...prePad, ...weeks];
};

// COMMAND PALETTE VIEW

const COMMAND_PALETTE_ITEMS = [
  { icon: "\u25A0", label: "Dashboard", section: "Dashboard" as const },
  { icon: "\u25CB", label: "Sessions", section: "Sessions" as const },
  { icon: "\u2699", label: "Config", section: "Config" as const },
  { icon: "\u25C9", label: "Graph", section: "Graph" as const },
];

const commandPaletteView = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (!model.commandPaletteOpen) {
    return h.empty;
  }

  const filtered =
    model.commandPaletteQuery.length > 0
      ? Arr.filter(COMMAND_PALETTE_ITEMS, (item) =>
          item.label.toLowerCase().includes(model.commandPaletteQuery.toLowerCase()),
        )
      : COMMAND_PALETTE_ITEMS;

  return h.div(
    [h.Class("cmd-palette-backdrop"), h.OnClick(ToggledCommandPalette())],
    [
      h.div(
        [h.Class("cmd-palette"), h.OnClick(IgnoredPaletteClick())],
        [
          h.input([
            h.Class("cmd-palette-input"),
            h.Placeholder("Type a command..."),
            h.OnInput((value) => UpdatedCommandPaletteQuery({ query: value })),
          ]),
          h.div(
            [h.Class("cmd-palette-results")],
            Arr.map(filtered, (item, idx) =>
              h.div(
                [
                  h.Class(
                    idx === model.commandPaletteActiveIndex
                      ? "cmd-palette-item active"
                      : "cmd-palette-item",
                  ),
                  h.OnClick(
                    item.section === "Dashboard"
                      ? Navigated({ route: Route.Dashboard() })
                      : item.section === "Config"
                        ? Navigated({ route: Route.Config() })
                        : item.section === "Graph"
                          ? Navigated({ route: Route.Graph() })
                          : Navigated({ route: Route.Sessions() }),
                  ),
                ],
                [h.span([h.Class("cmd-palette-item-icon")], [item.icon]), item.label],
              ),
            ),
          ),
        ],
      ),
    ],
  );
};

const projectDropdown = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class("project-dropdown"),
      h.Style({
        position: "absolute",
        top: "100%",
        left: "0",
        paddingTop: "4px",
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "4px 0",
        minWidth: "200px",
        zIndex: "100",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }),
    ],
    Arr.map(model.projects, (project) =>
      h.div(
        [
          h.Class("project-dropdown-item"),
          h.Style({
            padding: "6px 12px",
            fontSize: "13px",
            color: project.isActive ? "var(--accent)" : "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }),
          h.OnClick(SelectedProject({ id: project.id })),
        ],
        [h.span([], [project.isActive ? "\u25CF" : "\u25CB"]), h.span([], [project.name])],
      ),
    ),
  );

// SHELL VIEW

const shellView = (model: Model, content: Html, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class("app"),
      h.DataAttribute("theme", model.theme === "Dark" ? "dark" : "light"),
      h.DataAttribute("density", model.density),
    ],
    [
      h.div(
        [h.Class("app-body")],
        [
          h.main(
            [h.Class("main-content")],
            [
              h.header(
                [h.Class("topnav")],
                [
                  h.div(
                    [h.Class("topnav-bar")],
                    [
                      h.div(
                        [
                          h.Class("topnav-brand"),
                          h.Style({ cursor: "pointer" }),
                          h.OnClick(Navigated({ route: Route.Dashboard() })),
                        ],
                        [
                          h.span(
                            [h.Class("topnav-brand-icon")],
                            [
                              glyphRegistry[model.faviconIndex % glyphRegistry.length] ??
                                "\u{1D726}",
                            ],
                          ),
                          h.span([h.Class("topnav-brand-name")], ["anakmagang"]),
                        ],
                      ),
                      h.div(
                        [h.Class("topnav-actions")],
                        [
                          h.button(
                            [
                              h.Class("topnav-layout-btn"),
                              h.Title("Toggle theme"),
                              h.OnClick(ToggledTheme()),
                            ],
                            [model.theme === "Dark" ? "\u2600" : "\u263D"],
                          ),
                          h.a(
                            [
                              h.Class("topnav-layout-btn"),
                              h.Href("https://github.com/r17x/anakmagang?ref=anakmagang"),
                              h.Target("_blank"),
                              h.Title("GitHub"),
                            ],
                            [
                              h.svg(
                                [
                                  h.ViewBox("0 0 16 16"),
                                  h.Fill("currentColor"),
                                  h.Width("16"),
                                  h.Height("16"),
                                ],
                                [
                                  h.path(
                                    [
                                      h.D(
                                        "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z",
                                      ),
                                    ],
                                    [],
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              content,
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("status-bar")],
        [
          h.div(
            [h.Class("status-segment"), h.OnClick(CycledDensity())],
            [h.span([h.Class("label")], ["density"]), h.span([h.Class("value")], [model.density])],
          ),
        ],
      ),
      commandPaletteView(model, h),
    ],
  );

// DASHBOARD CONTENT

const dashboardContent = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("view-container")],
    [
      h.div(
        [
          h.Class("view-header"),
          h.Style({
            position: "relative",
            cursor: "pointer",
            zIndex: model.projectHoverOpen ? "10" : "auto",
          }),
          h.OnMouseEnter(ToggledProjectHover({ open: true })),
          h.OnMouseLeave(ToggledProjectHover({ open: false })),
        ],
        [
          h.span([h.Class("view-header-icon")], ["\u25A0"]),
          ` ${model.projectName || "Dashboard"}`,
          ...(model.projectHoverOpen && model.projects.length > 1
            ? [projectDropdown(model, h)]
            : []),
        ],
      ),
      M.value(model.dashboardStats).pipe(
        withHtmlReturn,
        M.tagsExhaustive({
          NotAsked: () => dashboardBodySkeleton,
          Loading: () => dashboardBodySkeleton,
          Failure: ({ error }) => errorView("Dashboard", error),
          Success: ({ data }) => {
            const completionPct =
              data.completionRate > 1
                ? Math.round(data.completionRate)
                : Math.round(data.completionRate * 100);
            const heatmapWeeks = buildHeatmapWeeks(data.heatmap, model.heatmapPeriod);
            const dayCount =
              model.heatmapPeriod === "7d"
                ? 7
                : model.heatmapPeriod === "1m"
                  ? 30
                  : model.heatmapPeriod === "3m"
                    ? 90
                    : 365;
            const periodSessions = Option.match(model.heatmapDateFilter, {
              onNone: () => Arr.reduce(data.heatmap.slice(-dayCount), 0, (acc, e) => acc + e.count),
              onSome: (date) =>
                Arr.findFirst(data.heatmap, (e) => e.date === date).pipe(
                  Option.map((e) => e.count),
                  Option.getOrElse(() => 0),
                ),
            });
            const sessionsReady = RD.$is("Success")(model.sessions);
            const recentSessions = getVisibleSessions(model);

            return h.div(
              [],
              [
                h.div(
                  [h.Class("stat-row")],
                  [
                    h.div(
                      [h.Class("stat-card")],
                      [
                        h.div(
                          [h.Class("stat-card-header")],
                          [
                            h.span(
                              [h.Class("stat-card-label")],
                              [
                                h.span([h.Class("stat-card-label-icon")], ["\u25CB"]),
                                "Active Sessions",
                              ],
                            ),
                          ],
                        ),
                        h.div([h.Class("stat-card-value")], [String(data.activeSessions)]),
                        h.div(
                          [h.Class("stat-card-footer")],
                          [
                            h.span(
                              [h.Class("trend up")],
                              [
                                h.span([h.Class("trend-arrow")], ["\u2191"]),
                                h.span([h.Class("trend-value")], ["50%"]),
                              ],
                            ),
                            h.span(
                              [h.Class("sparkline")],
                              [
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "8px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "12px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "6px" })], []),
                                h.span(
                                  [h.Class("sparkline-bar highlight"), h.Style({ height: "16px" })],
                                  [],
                                ),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "10px" })], []),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    h.div(
                      [h.Class("stat-card")],
                      [
                        h.div(
                          [h.Class("stat-card-header")],
                          [
                            h.span(
                              [h.Class("stat-card-label")],
                              [h.span([h.Class("stat-card-label-icon")], ["\u25A0"]), "Phases"],
                            ),
                          ],
                        ),
                        h.div([h.Class("stat-card-value")], [String(data.totalPhases)]),
                        h.div(
                          [h.Class("stat-card-footer")],
                          [
                            h.span(
                              [h.Class("trend up")],
                              [
                                h.span([h.Class("trend-arrow")], ["\u2191"]),
                                h.span([h.Class("trend-value")], [`${data.totalPhases}`]),
                              ],
                            ),
                            h.span(
                              [h.Class("sparkline")],
                              [
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "10px" })], []),
                                h.span(
                                  [h.Class("sparkline-bar highlight"), h.Style({ height: "14px" })],
                                  [],
                                ),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "8px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "12px" })], []),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    h.div(
                      [h.Class("stat-card")],
                      [
                        h.div(
                          [h.Class("stat-card-header")],
                          [
                            h.span(
                              [h.Class("stat-card-label")],
                              [h.span([h.Class("stat-card-label-icon")], ["\u25A0"]), "Guards"],
                            ),
                          ],
                        ),
                        h.div([h.Class("stat-card-value")], [String(data.guardCount)]),
                        h.div(
                          [h.Class("stat-card-footer")],
                          [
                            h.span(
                              [h.Class("trend up")],
                              [
                                h.span([h.Class("trend-arrow")], ["\u2191"]),
                                h.span([h.Class("trend-value")], ["all passing"]),
                              ],
                            ),
                            h.span(
                              [h.Class("sparkline")],
                              [
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "26px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "26px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "26px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "26px" })], []),
                                h.span(
                                  [h.Class("sparkline-bar highlight"), h.Style({ height: "26px" })],
                                  [],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    h.div(
                      [h.Class("stat-card")],
                      [
                        h.div(
                          [h.Class("stat-card-header")],
                          [
                            h.span(
                              [h.Class("stat-card-label")],
                              [h.span([h.Class("stat-card-label-icon")], ["\u25A0"]), "Sizes"],
                            ),
                          ],
                        ),
                        h.div([h.Class("stat-card-value")], [String(data.totalSessions)]),
                        h.div(
                          [h.Class("stat-card-footer")],
                          [
                            h.span(
                              [h.Class("trend")],
                              [
                                h.span(
                                  [h.Class("trend-value")],
                                  [
                                    Object.entries(data.sizeCounts)
                                      .map(([k, v]) => `${k[0]}:${v}`)
                                      .join(" "),
                                  ],
                                ),
                              ],
                            ),
                            h.span(
                              [h.Class("sparkline")],
                              [
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "10px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "14px" })], []),
                                h.span(
                                  [h.Class("sparkline-bar highlight"), h.Style({ height: "8px" })],
                                  [],
                                ),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "12px" })], []),
                                h.span([h.Class("sparkline-bar"), h.Style({ height: "16px" })], []),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Class("dashboard-grid")],
                  [
                    h.div(
                      [h.Class("chart-container")],
                      [
                        h.div(
                          [h.Class("chart-header")],
                          [
                            h.div(
                              [],
                              [
                                h.div([h.Class("chart-title")], [`${periodSessions} Sessions`]),
                                h.div(
                                  [h.Class("chart-subtitle")],
                                  [
                                    model.heatmapPeriod === "7d"
                                      ? "Completed in last 7 days"
                                      : model.heatmapPeriod === "1m"
                                        ? "Completed in last 30 days"
                                        : model.heatmapPeriod === "3m"
                                          ? "Completed in last 3 months"
                                          : "Completed in last year",
                                  ],
                                ),
                              ],
                            ),
                            h.div(
                              [h.Class("period-toggle")],
                              [
                                h.button(
                                  [
                                    h.Class(
                                      model.heatmapPeriod === "7d"
                                        ? "period-toggle-btn active"
                                        : "period-toggle-btn",
                                    ),
                                    h.OnClick(SelectedHeatmapPeriod({ period: "7d" })),
                                  ],
                                  ["7D"],
                                ),
                                h.button(
                                  [
                                    h.Class(
                                      model.heatmapPeriod === "1m"
                                        ? "period-toggle-btn active"
                                        : "period-toggle-btn",
                                    ),
                                    h.OnClick(SelectedHeatmapPeriod({ period: "1m" })),
                                  ],
                                  ["1M"],
                                ),
                                h.button(
                                  [
                                    h.Class(
                                      model.heatmapPeriod === "3m"
                                        ? "period-toggle-btn active"
                                        : "period-toggle-btn",
                                    ),
                                    h.OnClick(SelectedHeatmapPeriod({ period: "3m" })),
                                  ],
                                  ["3M"],
                                ),
                                h.button(
                                  [
                                    h.Class(
                                      model.heatmapPeriod === "1y"
                                        ? "period-toggle-btn active"
                                        : "period-toggle-btn",
                                    ),
                                    h.OnClick(SelectedHeatmapPeriod({ period: "1y" })),
                                  ],
                                  ["1Y"],
                                ),
                              ],
                            ),
                          ],
                        ),
                        h.div(
                          [h.Class("heatmap-grid")],
                          [
                            h.div(
                              [h.Class("heatmap-day-labels")],
                              [
                                h.span([], [""]),
                                h.span([], ["Mon"]),
                                h.span([], [""]),
                                h.span([], ["Wed"]),
                                h.span([], [""]),
                                h.span([], ["Fri"]),
                                h.span([], [""]),
                              ],
                            ),
                            h.div(
                              [h.Class("heatmap-weeks")],
                              Arr.map(heatmapWeeks, (week) =>
                                h.div(
                                  [h.Class("heatmap-week")],
                                  Arr.map(week, (cell) =>
                                    h.div(
                                      [
                                        h.Class(
                                          `heatmap-cell level-${cell.level}${cell.date && Option.isSome(model.heatmapDateFilter) && model.heatmapDateFilter.value === cell.date ? " selected" : ""}`,
                                        ),
                                        ...(cell.date
                                          ? [
                                              h.OnClick(ClickedHeatmapCell({ date: cell.date })),
                                              h.Style({ cursor: "pointer" }),
                                            ]
                                          : []),
                                      ],
                                      [],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        h.div(
                          [h.Class("heatmap-legend")],
                          [
                            "Less",
                            h.span(
                              [h.Class("heatmap-legend-cells")],
                              [
                                h.span([h.Class("heatmap-legend-cell level-0")], []),
                                h.span([h.Class("heatmap-legend-cell level-1")], []),
                                h.span([h.Class("heatmap-legend-cell level-2")], []),
                                h.span([h.Class("heatmap-legend-cell level-3")], []),
                                h.span([h.Class("heatmap-legend-cell level-4")], []),
                              ],
                            ),
                            "More",
                          ],
                        ),
                      ],
                    ),
                    h.div(
                      [
                        h.Style({
                          display: "flex",
                          "flex-direction": "column",
                          gap: "var(--space-md)",
                        }),
                      ],
                      [
                        h.div(
                          [h.Class("metric-card")],
                          [
                            h.div(
                              [h.Class("metric-card-trend")],
                              [
                                h.span(
                                  [h.Class("trend up")],
                                  [
                                    h.span([h.Class("trend-arrow")], ["\u2191"]),
                                    h.span(
                                      [h.Class("trend-value")],
                                      [String(data.totalSessions - data.activeSessions)],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            h.div([h.Class("metric-card-value")], [String(data.totalSessions)]),
                            h.div([h.Class("metric-card-desc")], ["Total sessions"]),
                          ],
                        ),
                        h.div(
                          [h.Class("metric-card")],
                          [
                            h.div(
                              [h.Class("metric-card-trend")],
                              [
                                h.span(
                                  [h.Class("trend up")],
                                  [
                                    h.span([h.Class("trend-arrow")], ["\u2191"]),
                                    h.span([h.Class("trend-value")], [`${completionPct}%`]),
                                  ],
                                ),
                              ],
                            ),
                            h.div([h.Class("metric-card-value")], [`${completionPct}%`]),
                            h.div([h.Class("metric-card-desc")], ["Completion rate"]),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                h.div(
                  [
                    h.Class("section-title clickable"),
                    h.OnClick(Navigated({ route: Route.Sessions() })),
                  ],
                  [
                    Option.isSome(model.heatmapDateFilter)
                      ? `Sessions on ${model.heatmapDateFilter.value}`
                      : "Recent Sessions",
                  ],
                ),
                h.div(
                  [h.Class("filter-tabs")],
                  [
                    h.button(
                      [
                        h.Class(model.sessionFilter === "all" ? "filter-tab active" : "filter-tab"),
                        h.OnClick(FilteredSessions({ filter: "all" })),
                      ],
                      ["All"],
                    ),
                    h.button(
                      [
                        h.Class(
                          model.sessionFilter === "active" ? "filter-tab active" : "filter-tab",
                        ),
                        h.OnClick(FilteredSessions({ filter: "active" })),
                      ],
                      ["Active"],
                    ),
                    h.button(
                      [
                        h.Class(
                          model.sessionFilter === "completed" ? "filter-tab active" : "filter-tab",
                        ),
                        h.OnClick(FilteredSessions({ filter: "completed" })),
                      ],
                      ["Completed"],
                    ),
                  ],
                ),
                ...(sessionsReady
                  ? [
                      h.div(
                        [h.Class("recent-sessions-table")],
                        [
                          h.table(
                            [h.Class("data-table")],
                            [
                              h.thead(
                                [],
                                [
                                  h.tr(
                                    [],
                                    [
                                      h.th([], ["Status"]),
                                      h.th([], ["Task"]),
                                      h.th([], ["Phase"]),
                                      h.th([], ["Size"]),
                                    ],
                                  ),
                                ],
                              ),
                              h.tbody(
                                [],
                                Arr.map(recentSessions, (session, idx) => {
                                  const isFiltered =
                                    model.sessionFilter === "all"
                                      ? false
                                      : model.sessionFilter === "active"
                                        ? !session.isActive
                                        : session.isActive;
                                  return h.tr(
                                    [
                                      h.Class(
                                        `clickable${Option.exists(model.selectedRowIndex, Equal.equals(idx)) ? " selected" : ""}${isFiltered ? " filtered-hidden" : ""}`,
                                      ),
                                      h.OnClick(
                                        Navigated({
                                          route: Route.SessionDetail({ id: session.id }),
                                        }),
                                      ),
                                    ],
                                    [
                                      h.td(
                                        [],
                                        [
                                          h.span(
                                            [
                                              h.Class(
                                                session.isActive ? "dot-active" : "dot-inactive",
                                              ),
                                            ],
                                            [],
                                          ),
                                        ],
                                      ),
                                      h.td([], [session.task || "—"]),
                                      h.td([], [session.phase || "—"]),
                                      h.td(
                                        [],
                                        [h.span([h.Class("badge badge-size")], [session.size])],
                                      ),
                                    ],
                                  );
                                }),
                              ),
                            ],
                          ),
                          h.div(
                            [h.Class("keyboard-hints")],
                            ["j/k navigate \u00B7 Enter open \u00B7 Esc close \u00B7 / search"],
                          ),
                        ],
                      ),
                    ]
                  : [
                      h.div(
                        [],
                        [
                          h.div(
                            [h.Class("skeleton-table-row")],
                            [
                              h.div([h.Class("skeleton skeleton-badge")], []),
                              h.div([h.Class("skeleton skeleton-cell-task")], []),
                              h.div([h.Class("skeleton skeleton-cell-phase")], []),
                              h.div([h.Class("skeleton skeleton-cell-size")], []),
                            ],
                          ),
                          h.div(
                            [h.Class("skeleton-table-row")],
                            [
                              h.div([h.Class("skeleton skeleton-badge")], []),
                              h.div([h.Class("skeleton skeleton-cell-task")], []),
                              h.div([h.Class("skeleton skeleton-cell-phase")], []),
                              h.div([h.Class("skeleton skeleton-cell-size")], []),
                            ],
                          ),
                          h.div(
                            [h.Class("skeleton-table-row")],
                            [
                              h.div([h.Class("skeleton skeleton-badge")], []),
                              h.div([h.Class("skeleton skeleton-cell-task")], []),
                              h.div([h.Class("skeleton skeleton-cell-phase")], []),
                              h.div([h.Class("skeleton skeleton-cell-size")], []),
                            ],
                          ),
                        ],
                      ),
                    ]),
              ],
            );
          },
        }),
      ),
    ],
  );

// SESSIONS CONTENT

const sessionsContent = (model: Model, h: HtmlBuilder<Message>): Html =>
  M.value(model.sessions).pipe(
    withHtmlReturn,
    M.tagsExhaustive({
      NotAsked: () => sessionsSkeleton,
      Loading: () => sessionsSkeleton,
      Failure: ({ error }) => errorView("Sessions", error),
      Success: ({ data }) => {
        const isCollapsed = Option.isSome(model.selectedSessionInList);
        const filtered = Arr.filter(data, (session) =>
          model.sessionFilter === "all"
            ? true
            : model.sessionFilter === "active"
              ? session.isActive
              : !session.isActive,
        );

        const selectedIdx = Option.flatMap(model.selectedSessionInList, (selectedId) =>
          Arr.findFirstIndex(filtered, (session) => session.id === selectedId),
        );

        const inlineDetail: Html = isCollapsed ? sessionInlineDetail(model, h) : h.empty;

        const viewHeader: Html = Option.match(model.selectedSessionInList, {
          onNone: () =>
            h.div(
              [h.Class("view-header")],
              [h.span([h.Class("view-header-icon")], ["\u25CB"]), " Sessions"],
            ),
          onSome: (selectedId) =>
            h.div(
              [h.Class("view-header")],
              [
                h.span([h.Class("view-header-icon")], ["\u25CF"]),
                ` Session ${selectedId.slice(0, 8)}\u2026`,
              ],
            ),
        });

        const filterTabs: Html = isCollapsed
          ? h.empty
          : h.div(
              [h.Class("filter-tabs")],
              [
                h.button(
                  [
                    h.Class(model.sessionFilter === "all" ? "filter-tab active" : "filter-tab"),
                    h.OnClick(FilteredSessions({ filter: "all" })),
                  ],
                  ["All"],
                ),
                h.button(
                  [
                    h.Class(model.sessionFilter === "active" ? "filter-tab active" : "filter-tab"),
                    h.OnClick(FilteredSessions({ filter: "active" })),
                  ],
                  ["Active"],
                ),
                h.button(
                  [
                    h.Class(
                      model.sessionFilter === "completed" ? "filter-tab active" : "filter-tab",
                    ),
                    h.OnClick(FilteredSessions({ filter: "completed" })),
                  ],
                  ["Completed"],
                ),
              ],
            );

        const table = h.table(
          [h.Class("data-table")],
          [
            h.thead(
              [],
              [
                h.tr(
                  [],
                  [
                    h.th([], ["Status"]),
                    h.th([], ["Task"]),
                    h.th([], ["Phase"]),
                    h.th([], ["Size"]),
                  ],
                ),
              ],
            ),
            h.tbody(
              [],
              Arr.map(filtered, (session, idx) => {
                const isSelectedInList = Option.exists(
                  model.selectedSessionInList,
                  Equal.equals(session.id),
                );
                const isSelectedByKeyboard = Option.exists(
                  model.selectedRowIndex,
                  Equal.equals(idx),
                );

                const peekClass = Option.match(selectedIdx, {
                  onNone: () => "",
                  onSome: (selIdx) => {
                    if (isSelectedInList) {
                      return "";
                    }
                    if (idx > selIdx && idx <= selIdx + 2) {
                      return " peek-hidden peek-adjacent";
                    }
                    return " peek-hidden";
                  },
                });

                return h.tr(
                  [
                    h.Class(
                      `clickable${isSelectedInList || isSelectedByKeyboard ? " selected" : ""}${peekClass}`,
                    ),
                    h.OnClick(SelectedSessionInList({ id: session.id })),
                  ],
                  [
                    h.td(
                      [],
                      [
                        h.span(
                          [
                            h.Class(
                              session.isActive ? "badge badge-active" : "badge badge-completed",
                            ),
                          ],
                          [session.isActive ? "active" : "done"],
                        ),
                      ],
                    ),
                    h.td([], [session.task || "—"]),
                    h.td([], [session.phase || "—"]),
                    h.td([], [h.span([h.Class("badge badge-size")], [session.size])]),
                  ],
                );
              }),
            ),
          ],
        );

        return h.div(
          [h.Class("view-container")],
          [
            viewHeader,
            filterTabs,
            h.div(
              [
                h.Class(
                  isCollapsed
                    ? "sessions-table-wrapper sessions-table-collapsed"
                    : "sessions-table-wrapper",
                ),
              ],
              [table],
            ),
            inlineDetail,
            h.div(
              [h.Class("keyboard-hints")],
              ["j/k navigate \u00B7 Enter open \u00B7 Esc close \u00B7 / search"],
            ),
          ],
        );
      },
    }),
  );

const totalProviderSessionCount = (ps: ReadonlyArray<typeof ProviderSession.Type>): number =>
  Arr.reduce(ps, 0, (acc, p) => acc + p.sessionIds.length);

const providerBadges = (
  data: SessionDetail,
  model: Model,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const total = totalProviderSessionCount(data.providerSessions);
  if (total === 0) return [];

  if (total === 1) {
    const ps = data.providerSessions[0];
    if (!ps) return [];
    return [
      h.span(
        [
          h.Class("badge badge-active"),
          h.Style({ "text-transform": "uppercase" }),
          h.Title(ps.sessionIds[0] ?? ""),
        ],
        [ps.provider],
      ),
    ];
  }

  return [
    h.div(
      [h.Class("provider-menu-wrapper")],
      [
        h.span(
          [
            h.Class("badge badge-active"),
            h.Style({ "text-transform": "uppercase", cursor: "pointer" }),
            h.OnClick(ToggledProviderMenu()),
          ],
          [
            `${data.providerSessions.length} provider${data.providerSessions.length > 1 ? "s" : ""}`,
          ],
        ),
        ...(model.providerMenuOpen
          ? [
              h.div(
                [h.Class("provider-menu-dropdown")],
                Arr.flatMap(data.providerSessions, (ps) =>
                  Arr.map(ps.sessionIds, (sid) =>
                    h.div(
                      [h.Class("provider-menu-item")],
                      [
                        h.span(
                          [h.Class("badge badge-size"), h.Style({ "text-transform": "uppercase" })],
                          [ps.provider],
                        ),
                        h.span(
                          [
                            h.Class(
                              `provider-session-id copyable${Option.exists(model.copiedText, (t) => t === sid) ? " copied" : ""}`,
                            ),
                            h.OnClick(ClickedCopy({ text: sid })),
                          ],
                          [
                            Option.exists(model.copiedText, (t) => t === sid)
                              ? "Copied!"
                              : ` ${sid}`,
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ]
          : []),
      ],
    ),
  ];
};

const TRANSCRIPT_PREVIEW_LENGTH = 200;

const transcriptMsgCard = (msg: TranscriptEntry, model: Model, h: HtmlBuilder<Message>): Html => {
  const expandable = msg.content.length > TRANSCRIPT_PREVIEW_LENGTH;
  const expanded =
    expandable && Option.exists(model.expandedTranscriptTs, Equal.equals(msg.timestamp));
  const contentText =
    expandable && !expanded ? msg.content.slice(0, TRANSCRIPT_PREVIEW_LENGTH) + "..." : msg.content;

  return h.div(
    [h.Class(`transcript-msg transcript-${msg.role}`)],
    [
      h.div(
        [h.Class("transcript-meta")],
        [
          h.span([h.Class("transcript-role")], [msg.role]),
          h.span([h.Class("transcript-time")], [new Date(msg.timestamp).toLocaleTimeString()]),
        ],
      ),
      ...(expandable
        ? [
            h.div(
              [
                h.Class("transcript-content"),
                h.Style({ cursor: "pointer" }),
                h.OnClick(ToggledTranscriptMsg({ timestamp: msg.timestamp })),
              ],
              [
                contentText,
                h.span([h.Class("transcript-expand")], [expanded ? " \u25BC" : " \u25B6"]),
              ],
            ),
          ]
        : [h.div([h.Class("transcript-content")], [contentText])]),
    ],
  );
};

const transcriptView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("transcript-container")],
    M.value(model.transcriptMessages).pipe(
      M.withReturnType<ReadonlyArray<Html>>(),
      M.tagsExhaustive({
        NotAsked: () => [
          h.div([h.Class("transcript-empty")], ["Select Live tab to view transcript"]),
        ],
        Loading: () => transcriptSkeleton,
        Failure: ({ error }) => [errorView("Transcript", error)],
        Success: ({ data }) =>
          data.length === 0
            ? [h.div([h.Class("transcript-empty")], ["No transcript messages yet"])]
            : Arr.chop(data, (msgs): [Html, ReadonlyArray<TranscriptEntry>] => {
                const [head, ...tail] = msgs;
                const next = tail[0];
                if (head.role === "user" && next !== undefined && next.role === "assistant") {
                  return [
                    h.div(
                      [h.Class("transcript-pair")],
                      [transcriptMsgCard(head, model, h), transcriptMsgCard(next, model, h)],
                    ),
                    tail.slice(1),
                  ];
                }
                return [
                  h.div([h.Class("transcript-pair")], [transcriptMsgCard(head, model, h)]),
                  tail,
                ];
              }),
      }),
    ),
  );

const sessionDetailBody = (
  data: SessionDetail,
  model: Model,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html | string> => [
  h.div(
    [h.Class("session-header")],
    [
      h.span(
        [
          h.Class(
            `session-id-full copyable${Option.exists(model.copiedText, (t) => t === data.id) ? " copied" : ""}`,
          ),
          h.OnClick(ClickedCopy({ text: data.id })),
        ],
        [Option.exists(model.copiedText, (t) => t === data.id) ? "Copied!" : data.id],
      ),
      h.span(
        [h.Class(data.isActive ? "badge badge-active" : "badge badge-completed")],
        [data.isActive ? "Active" : "Completed"],
      ),
      h.span([h.Class("badge badge-size")], [data.size]),
      ...(data.sizePresetCriteria.length > 0
        ? [
            h.span(
              [h.Class("badge badge-size"), h.Title(data.sizePresetCriteria.join(" | "))],
              [`${data.sizePresetCriteria.length} criteria`],
            ),
          ]
        : []),
      ...providerBadges(data, model, h),
    ],
  ),
  h.div([h.Class("session-task-title")], [data.task]),
  h.div(
    [h.Class("panel")],
    [
      h.div(
        [h.Class("panel-header")],
        [h.span([h.Class("panel-header-accent")], [">"]), " Observations"],
      ),
      h.div(
        [h.Class("panel-body")],
        data.observations.length > 0
          ? Arr.map(data.observations, (obs) => h.div([h.Class("observation-item")], [obs]))
          : [h.div([h.Class("observation-item")], ["No observations yet"])],
      ),
    ],
  ),
  ...(data.guardEvents.length > 0
    ? [
        h.div(
          [h.Class("panel")],
          [
            h.div(
              [h.Class("panel-header")],
              [
                h.span([h.Class("panel-header-accent")], ["\u26A1"]),
                ` Guard Events (${data.guardEvents.length})`,
              ],
            ),
            h.div(
              [h.Class("panel-body")],
              [
                h.div(
                  [h.Class("guard-event-log")],
                  Arr.map(data.guardEvents, (ge) =>
                    h.div(
                      [
                        h.Class(
                          `guard-event-item ${ge.decision === "allow" ? "allowed" : ge.decision === "warn" ? "warned" : "blocked"}`,
                        ),
                      ],
                      [
                        h.span([h.Class("guard-event-guard")], [ge.guard]),
                        ...(Option.isSome(ge.message)
                          ? [h.span([h.Class("guard-event-message")], [ge.message.value])]
                          : []),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ]
    : []),
  h.div(
    [h.Class("tab-bar")],
    [
      h.button(
        [
          h.Class(model.liveTab === "timeline" ? "tab-btn active" : "tab-btn"),
          h.OnClick(SwitchedLiveTab({ tab: "timeline" })),
        ],
        ["Timeline"],
      ),
      h.button(
        [
          h.Class(model.liveTab === "live" ? "tab-btn active" : "tab-btn"),
          h.OnClick(SwitchedLiveTab({ tab: "live" })),
        ],
        ["Live"],
      ),
    ],
  ),
  ...(model.liveTab === "live"
    ? [transcriptView(model, h)]
    : [
        h.div(
          [h.Class("two-col")],
          [
            h.div(
              [h.Class("event-timeline")],
              (() => {
                type TimelineGroup =
                  | {
                      readonly _tag: "single";
                      readonly phase: (typeof model.phases)[number];
                      readonly idx: number;
                      readonly status: string;
                    }
                  | {
                      readonly _tag: "cluster";
                      readonly phases: ReadonlyArray<{
                        readonly phase: (typeof model.phases)[number];
                        readonly idx: number;
                      }>;
                      readonly status: "skipped";
                    };

                const grouped = Arr.reduce(
                  Arr.map(model.phases, (phase, idx) => ({
                    phase,
                    idx,
                    status: phaseStatus(
                      phase.id,
                      data.completedPhases,
                      data.phase,
                      data.activePhases,
                    ),
                  })),
                  [] as ReadonlyArray<TimelineGroup>,
                  (acc, item) => {
                    if (item.status !== "skipped")
                      return Arr.append(acc, {
                        _tag: "single" as const,
                        phase: item.phase,
                        idx: item.idx,
                        status: item.status,
                      });
                    const last = Arr.last(acc);
                    if (Option.isSome(last) && last.value._tag === "cluster") {
                      const prev = last.value;
                      const updated: TimelineGroup = {
                        _tag: "cluster" as const,
                        phases: Arr.append(prev.phases, { phase: item.phase, idx: item.idx }),
                        status: "skipped" as const,
                      };
                      return Arr.append(Arr.take(acc, acc.length - 1), updated);
                    }
                    return Arr.append(acc, {
                      _tag: "cluster" as const,
                      phases: [{ phase: item.phase, idx: item.idx }],
                      status: "skipped" as const,
                    });
                  },
                );

                const totalGroups = grouped.length;
                return Arr.flatMap(grouped, (group, groupIdx) => {
                  const isLast = groupIdx === totalGroups - 1;
                  if (group._tag === "single") {
                    const { phase: phaseInfo, idx, status } = group;
                    const isExpanded = Option.exists(model.expandedPhaseIndex, Equal.equals(idx));
                    return [
                      h.div(
                        [
                          h.Class(
                            `event-timeline-item${isExpanded ? " selected" : ""}${status === "skipped" ? " skipped" : ""}`,
                          ),
                          ...(status === "skipped"
                            ? []
                            : [
                                h.OnClick(ToggledPhaseDetail({ index: idx })),
                                h.OnMouseEnter(HoveredPhase({ index: idx })),
                              ]),
                        ],
                        [
                          h.div(
                            [h.Class("event-timeline-node")],
                            [
                              h.div([h.Class(`event-timeline-dot ${status}`)], []),
                              ...(!isLast ? [h.div([h.Class("event-timeline-line")], [])] : []),
                            ],
                          ),
                          h.div(
                            [h.Class("event-timeline-content")],
                            [
                              h.div([h.Class(`event-timeline-type ${status}`)], [status]),
                              h.div(
                                [h.Class("event-timeline-desc")],
                                [`${idx + 1}. ${phaseInfo.name}`],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ];
                  }
                  if (group.phases.length === 1) {
                    const entry = group.phases[0];
                    if (!entry) return [];
                    const { phase: phaseInfo, idx } = entry;
                    return [
                      h.div(
                        [h.Class("event-timeline-item skipped")],
                        [
                          h.div(
                            [h.Class("event-timeline-node")],
                            [
                              h.div([h.Class("event-timeline-dot skipped")], []),
                              ...(!isLast
                                ? [
                                    h.div(
                                      [h.Class("event-timeline-line event-timeline-line-dashed")],
                                      [],
                                    ),
                                  ]
                                : []),
                            ],
                          ),
                          h.div(
                            [h.Class("event-timeline-content")],
                            [
                              h.div([h.Class("event-timeline-type skipped")], ["skipped"]),
                              h.div(
                                [h.Class("event-timeline-desc")],
                                [`${idx + 1}. ${phaseInfo.name}`],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ];
                  }
                  const isClusterExpanded = Option.exists(
                    model.expandedClusterIndex,
                    Equal.equals(groupIdx),
                  );

                  if (isClusterExpanded) {
                    return Arr.flatMap(group.phases, (item, itemIdx) => [
                      h.div(
                        [h.Class("event-timeline-item skipped"), h.OnMouseLeave(LeftCluster())],
                        [
                          h.div(
                            [h.Class("event-timeline-node")],
                            [
                              h.div([h.Class("event-timeline-dot skipped")], []),
                              ...(!(isLast && itemIdx === group.phases.length - 1)
                                ? [
                                    h.div(
                                      [h.Class("event-timeline-line event-timeline-line-dashed")],
                                      [],
                                    ),
                                  ]
                                : []),
                            ],
                          ),
                          h.div(
                            [h.Class("event-timeline-content")],
                            [
                              h.div([h.Class("event-timeline-type skipped")], ["skipped"]),
                              h.div(
                                [h.Class("event-timeline-desc")],
                                [`${item.idx + 1}. ${item.phase.name}`],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ]);
                  }

                  return [
                    h.div(
                      [
                        h.Class("event-timeline-item skipped cluster-collapsed"),
                        h.OnMouseEnter(HoveredCluster({ index: groupIdx })),
                      ],
                      [
                        h.div(
                          [h.Class("event-timeline-node")],
                          [
                            h.div([h.Class("event-timeline-dot skipped")], []),
                            ...(!isLast
                              ? [
                                  h.div(
                                    [h.Class("event-timeline-line event-timeline-line-dashed")],
                                    [],
                                  ),
                                ]
                              : []),
                          ],
                        ),
                        h.div(
                          [h.Class("event-timeline-content")],
                          [
                            h.div([h.Class("event-timeline-type skipped")], ["skipped"]),
                            h.div(
                              [h.Class("event-timeline-desc")],
                              [`${group.phases.length} skipped`],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ];
                });
              })(),
            ),
            h.div(
              [],
              [
                ...Option.match(model.expandedPhaseIndex, {
                  onNone: () => [
                    h.div(
                      [h.Class("panel")],
                      [
                        h.div(
                          [h.Class("panel-header")],
                          [h.span([h.Class("panel-header-accent")], ["\u2726"]), " Phase Detail"],
                        ),
                        h.div(
                          [h.Class("panel-body")],
                          [
                            h.div(
                              [
                                h.Class("reflection-text"),
                                h.Style({ color: "var(--text-dim)", "font-style": "italic" }),
                              ],
                              ["Hover or click a phase to see details"],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                  onSome: (idx) => {
                    const phaseInfo = Arr.get(model.phases, idx);
                    if (Option.isNone(phaseInfo)) return [];
                    const phase = phaseInfo.value;
                    const maybeReflection = Arr.findFirst(
                      data.reflections,
                      (r) => r.phase === phase.id,
                    );
                    const status = phaseStatus(
                      phase.id,
                      data.completedPhases,
                      data.phase,
                      data.activePhases,
                    );
                    return [
                      h.div(
                        [h.Class("panel")],
                        [
                          h.div(
                            [h.Class("panel-header")],
                            [
                              h.span([h.Class("panel-header-accent")], ["\u2726"]),
                              ` Phase ${idx + 1}: ${phase.name}`,
                              h.span(
                                [
                                  h.Class(
                                    `badge badge-${status === "completed" ? "completed" : status === "active" ? "active" : "size"}`,
                                  ),
                                  h.Style({ "margin-left": "var(--space-xs)" }),
                                ],
                                [status],
                              ),
                            ],
                          ),
                          h.div(
                            [h.Class("panel-body")],
                            [
                              h.div(
                                [
                                  h.Class("reflection-text"),
                                  h.Style({
                                    color: "var(--accent-light)",
                                    "font-style": "italic",
                                    "margin-bottom": "var(--space-sm)",
                                  }),
                                ],
                                [phase.exitQuestion],
                              ),
                              Option.match(maybeReflection, {
                                onNone: () =>
                                  h.div(
                                    [
                                      h.Class("reflection-text"),
                                      h.Style({ color: "var(--text-dim)", "font-style": "italic" }),
                                    ],
                                    ["No reflection recorded."],
                                  ),
                                onSome: ({ reflection }) =>
                                  h.div([h.Class("reflection-text")], [reflection]),
                              }),
                              ...(phase.skipWhen.length > 0
                                ? [
                                    h.div(
                                      [
                                        h.Style({
                                          "font-size": "var(--text-2xs)",
                                          color: "var(--text-dim)",
                                          "margin-top": "var(--space-xs)",
                                        }),
                                      ],
                                      ["Skipped for: " + phase.skipWhen.join(", ")],
                                    ),
                                  ]
                                : []),
                              ...(phase.actions.length > 0
                                ? [
                                    h.div(
                                      [
                                        h.Style({
                                          "font-size": "var(--text-2xs)",
                                          color: "var(--text-dim)",
                                          "margin-top": "var(--space-xs)",
                                        }),
                                      ],
                                      ["Actions: " + phase.actions.join(", ")],
                                    ),
                                  ]
                                : []),
                            ],
                          ),
                        ],
                      ),
                    ];
                  },
                }),
              ],
            ),
          ],
        ),
      ]),
];

const sessionInlineDetail = (model: Model, h: HtmlBuilder<Message>): Html =>
  M.value(model.sessionDetail).pipe(
    withHtmlReturn,
    M.tagsExhaustive({
      NotAsked: () =>
        h.div([h.Class("session-detail-inline")], ["Select a session to view details"]),
      Loading: () => sessionDetailSkeleton,
      Failure: ({ error }) => errorView("Session", error),
      Success: ({ data }) =>
        h.div(
          [h.Class(`session-detail-inline${isDetailStale(model) ? " detail-fetching" : ""}`)],
          sessionDetailBody(data, model, h),
        ),
    }),
  );

// CONFIG CONTENT

const configContent = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("view-container")],
    [
      h.div(
        [h.Class("view-header")],
        [h.span([h.Class("view-header-icon")], ["\u2699"]), ` ${model.projectName || "Config"}`],
      ),
      M.value(model.configSummary).pipe(
        withHtmlReturn,
        M.tagsExhaustive({
          NotAsked: () => h.div([], ["Navigate to Config to load configuration."]),
          Loading: () =>
            h.div(
              [],
              [
                skeletonLine("skeleton-line-lg"),
                skeletonLine("skeleton-line-md"),
                skeletonLine("skeleton-line-sm"),
              ],
            ),
          Failure: ({ error }) => errorView("Config", error),
          Success: ({ data: cfg }) =>
            h.div(
              [],
              [
                ...(cfg.guards.length > 0
                  ? [
                      h.div(
                        [h.Class("config-section-title")],
                        [
                          "Guards ",
                          h.span([h.Class("config-section-count")], [`(${cfg.guards.length})`]),
                        ],
                      ),
                      h.div(
                        [h.Class("guard-panel")],
                        Arr.map(cfg.guards, (g) =>
                          h.div(
                            [h.Class("guard-card")],
                            [
                              h.div(
                                [h.Class("guard-card-header")],
                                [
                                  h.span([h.Class("guard-card-type")], [g.type]),
                                  ...(g.event
                                    ? [h.span([h.Class("guard-card-event")], [g.event])]
                                    : []),
                                ],
                              ),
                              h.div([h.Class("guard-card-desc")], [g.description]),
                              ...(g.matcher
                                ? [h.div([h.Class("guard-card-matcher")], [g.matcher])]
                                : []),
                            ],
                          ),
                        ),
                      ),
                    ]
                  : []),
                ...(cfg.transitions.length > 0
                  ? [
                      h.div(
                        [h.Class("config-section-title")],
                        [
                          "Transitions ",
                          h.span(
                            [h.Class("config-section-count")],
                            [`(${cfg.transitions.length})`],
                          ),
                        ],
                      ),
                      h.div(
                        [h.Class("transition-panel")],
                        [
                          h.div(
                            [h.Class("transition-list")],
                            Arr.map(cfg.transitions, (t) =>
                              h.div(
                                [h.Class("transition-item")],
                                [
                                  h.span([h.Class("transition-from")], [t.from]),
                                  h.span([h.Class("transition-arrow")], ["\u2192"]),
                                  h.span([h.Class("transition-to")], [t.to]),
                                  ...(t.when
                                    ? [h.span([h.Class("transition-when")], [t.when])]
                                    : []),
                                  ...(t.description
                                    ? [h.span([h.Class("transition-desc")], [t.description])]
                                    : []),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ]
                  : []),
                ...(cfg.sizePresets.length > 0
                  ? [
                      h.div(
                        [h.Class("config-section-title")],
                        [
                          "Size Presets ",
                          h.span(
                            [h.Class("config-section-count")],
                            [`(${cfg.sizePresets.length})`],
                          ),
                        ],
                      ),
                      h.div(
                        [h.Class("size-presets-panel")],
                        [
                          h.div(
                            [h.Class("size-preset-grid")],
                            Arr.map(cfg.sizePresets, (sp) =>
                              h.div(
                                [h.Class("size-preset-card")],
                                [
                                  h.div([h.Class("size-preset-name")], [sp.name]),
                                  h.div(
                                    [h.Class("size-preset-phases")],
                                    [`${sp.activePhases.length} active phases`],
                                  ),
                                  ...(sp.criteria.length > 0
                                    ? [
                                        h.ul(
                                          [h.Class("size-preset-criteria")],
                                          Arr.map(sp.criteria, (c) => h.li([], [c])),
                                        ),
                                      ]
                                    : []),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ]
                  : []),
                ...(cfg.stores.length > 0
                  ? [
                      h.div(
                        [h.Class("config-section-title")],
                        [
                          "Stores ",
                          h.span([h.Class("config-section-count")], [`(${cfg.stores.length})`]),
                        ],
                      ),
                      h.div(
                        [h.Class("store-panel")],
                        [
                          h.div(
                            [h.Class("store-list")],
                            Arr.map(cfg.stores, (s) =>
                              h.div(
                                [h.Class("store-item")],
                                [
                                  h.span([h.Class("store-kind")], [s.kind]),
                                  h.span([h.Class("store-name")], [s.name]),
                                  h.span([h.Class("store-detail")], [s.detail]),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ]
                  : []),
              ],
            ),
        }),
      ),
    ],
  );

// GRAPH VIEW

const graphContent = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (Option.isSome(model.graphError)) return errorView("Graph", model.graphError.value);
  const gs = model.graphState as GraphState | null;
  if (!gs) return h.div([h.Class("graph-loading")], ["Loading graph..."]);
  const w = window.innerWidth;
  const gh = window.innerHeight - 76;
  return h.div(
    [h.Class("graph-container")],
    [
      Canvas.view<Message>(
        {
          width: w,
          height: gh,
          shapes: graphShapes(gs, w, gh, model.theme),
          className: "graph-canvas",
          onPointerDown: ({ x, y }) => PressedGraphCanvas({ x, y }),
          onPointerMove: ({ x, y }) => MovedGraphPointer({ x, y }),
          onPointerUp: ({ x, y }) => ReleasedGraphPointer({ x, y }),
        },
        h,
      ),
    ],
  );
};

// VIEW

const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const content = M.value(model.route).pipe(
    withHtmlReturn,
    M.tagsExhaustive({
      Dashboard: () => dashboardContent(model, h),
      Sessions: () => sessionsContent(model, h),
      SessionDetail: () => sessionsContent(model, h),
      Config: () => configContent(model, h),
      Graph: () => graphContent(model, h),
    }),
  );

  const prefix = model.projectName || "Anakmagang";
  const title = M.value(model.route).pipe(
    M.withReturnType<string>(),
    M.tagsExhaustive({
      Dashboard: () => `${prefix} - Dashboard`,
      Sessions: () => `${prefix} - Sessions`,
      SessionDetail: ({ id }) => `${prefix} - Session ${id.slice(0, 8)}`,
      Config: () => `${prefix} - Config`,
      Graph: () => `${prefix} - Graph`,
    }),
  );

  return { title, body: shellView(model, content, h) };
};

// ENTRY

const program = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById("app"),
  resources: WebClientLive,
});

Runtime.run(program);
