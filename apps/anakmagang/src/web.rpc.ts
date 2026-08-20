import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { SessionIdSchema } from "./Ulid";

export const Reflection = Schema.Struct({
  phase: Schema.String,
  reflection: Schema.String,
});

export const GuardEvent = Schema.Struct({
  guard: Schema.String,
  decision: Schema.String,
  message: Schema.OptionFromUndefinedOr(Schema.String),
});

export const ManifestEntry = Schema.Struct({
  type: Schema.String,
  fields: Schema.Record(Schema.String, Schema.String),
});

export const SessionSummary = Schema.Struct({
  id: SessionIdSchema,
  task: Schema.String,
  phase: Schema.String,
  size: Schema.String,
  isActive: Schema.Boolean,
});
export interface SessionSummary extends Schema.Schema.Type<typeof SessionSummary> {}

export const ProviderSession = Schema.Struct({
  provider: Schema.String,
  sessionIds: Schema.Array(Schema.String),
});
export interface ProviderSession extends Schema.Schema.Type<typeof ProviderSession> {}

export const HeatmapEntry = Schema.Struct({
  date: Schema.String,
  count: Schema.Number,
  level: Schema.Number,
});
export interface HeatmapEntry extends Schema.Schema.Type<typeof HeatmapEntry> {}

export const GuardInfo = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  event: Schema.String,
  matcher: Schema.String,
  enforcedBy: Schema.String,
});
export interface GuardInfo extends Schema.Schema.Type<typeof GuardInfo> {}

export const TransitionInfo = Schema.Struct({
  type: Schema.String,
  from: Schema.String,
  to: Schema.String,
  when: Schema.String,
  description: Schema.String,
});
export interface TransitionInfo extends Schema.Schema.Type<typeof TransitionInfo> {}

export const SizePresetInfo = Schema.Struct({
  name: Schema.String,
  activePhases: Schema.Array(Schema.String),
  criteria: Schema.Array(Schema.String),
});
export interface SizePresetInfo extends Schema.Schema.Type<typeof SizePresetInfo> {}

export const StoreInfo = Schema.Struct({
  kind: Schema.String,
  name: Schema.String,
  detail: Schema.String,
});
export interface StoreInfo extends Schema.Schema.Type<typeof StoreInfo> {}

export const ConfigSummary = Schema.Struct({
  name: Schema.String,
  version: Schema.Number,
  guards: Schema.Array(GuardInfo),
  transitions: Schema.Array(TransitionInfo),
  sizePresets: Schema.Array(SizePresetInfo),
  stores: Schema.Array(StoreInfo),
});
export interface ConfigSummary extends Schema.Schema.Type<typeof ConfigSummary> {}

export const GraphNode = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  kind: Schema.Literals(["session", "memory", "guard", "store", "transition", "size_preset"]),
  active: Schema.Boolean,
  weight: Schema.Number,
});
export interface GraphNode extends Schema.Schema.Type<typeof GraphNode> {}

export const GraphEdge = Schema.Struct({
  source: Schema.String,
  target: Schema.String,
  kind: Schema.Literals(["memory_derived", "session_memory"]),
});
export interface GraphEdge extends Schema.Schema.Type<typeof GraphEdge> {}

export const GraphResponse = Schema.Struct({
  nodes: Schema.Array(GraphNode),
  edges: Schema.Array(GraphEdge),
});
export interface GraphResponse extends Schema.Schema.Type<typeof GraphResponse> {}

export const SessionDetail = Schema.Struct({
  id: SessionIdSchema,
  task: Schema.String,
  phase: Schema.String,
  size: Schema.String,
  isActive: Schema.Boolean,
  completedPhases: Schema.Array(Schema.String),
  activePhases: Schema.Array(Schema.String),
  reflections: Schema.Array(Reflection),
  observations: Schema.Array(Schema.String),
  guardEvents: Schema.Array(GuardEvent),
  events: Schema.Array(ManifestEntry),
  providerSessions: Schema.Array(ProviderSession),
  transitions: Schema.Array(TransitionInfo),
  sizePresetCriteria: Schema.Array(Schema.String),
});
export interface SessionDetail extends Schema.Schema.Type<typeof SessionDetail> {}

export const DashboardStats = Schema.Struct({
  activeSessions: Schema.Number,
  totalSessions: Schema.Number,
  totalPhases: Schema.Number,
  completionRate: Schema.Number,
  guardCount: Schema.Number,
  sizeCounts: Schema.Record(Schema.String, Schema.Number),
  heatmap: Schema.Array(HeatmapEntry),
});
export interface DashboardStats extends Schema.Schema.Type<typeof DashboardStats> {}

export class WebRpcError extends Schema.TaggedClass<WebRpcError>()("WebRpcError", {
  message: Schema.String,
}) {}

const listSessions = Rpc.make("ListSessions", {
  success: Schema.Array(SessionSummary),
  error: WebRpcError,
});

const getSession = Rpc.make("GetSession", {
  payload: Schema.Struct({ id: SessionIdSchema }),
  success: SessionDetail,
  error: WebRpcError,
});

const getDashboard = Rpc.make("GetDashboard", {
  success: DashboardStats,
  error: WebRpcError,
});

const healthcheck = Rpc.make("Healthcheck");

const shutdown = Rpc.make("Shutdown");

export const PhaseInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  exitQuestion: Schema.String,
  skipWhen: Schema.Array(Schema.String),
  actions: Schema.Array(Schema.String),
});
export interface PhaseInfo extends Schema.Schema.Type<typeof PhaseInfo> {}

const getPhases = Rpc.make("GetPhases", {
  success: Schema.Array(PhaseInfo),
});

export const TranscriptEntry = Schema.Struct({
  role: Schema.String,
  content: Schema.String,
  timestamp: Schema.String,
  provider: Schema.String,
  providerSessionId: Schema.String,
});
export interface TranscriptEntry extends Schema.Schema.Type<typeof TranscriptEntry> {}

const getTranscript = Rpc.make("GetTranscript", {
  payload: Schema.Struct({ sessionId: SessionIdSchema }),
  success: Schema.Array(TranscriptEntry),
  error: WebRpcError,
});

const getConfig = Rpc.make("GetConfig", {
  success: ConfigSummary,
});

const getGraph = Rpc.make("GetGraph", {
  success: GraphResponse,
  error: WebRpcError,
});

const getGlyphs = Rpc.make("GetGlyphs", {
  success: Schema.Array(Schema.String),
});

export const ProjectInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  root: Schema.String,
  isActive: Schema.Boolean,
});
export interface ProjectInfo extends Schema.Schema.Type<typeof ProjectInfo> {}

const listProjects = Rpc.make("ListProjects", {
  success: Schema.Array(ProjectInfo),
});

const registerProject = Rpc.make("RegisterProject", {
  payload: Schema.Struct({ root: Schema.String }),
  success: ProjectInfo,
});

const setActiveProject = Rpc.make("SetActiveProject", {
  payload: Schema.Struct({ id: Schema.String }),
});

export class PhaseEngineRpcError extends Schema.TaggedClass<PhaseEngineRpcError>()(
  "PhaseEngineRpcError",
  {
    message: Schema.String,
  },
) {}

export const PhaseInfoRpc = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  number: Schema.Number,
});
export interface PhaseInfoRpc extends Schema.Schema.Type<typeof PhaseInfoRpc> {}

export const StartResultRpc = Schema.Struct({
  sessionId: SessionIdSchema,
  phase: PhaseInfoRpc,
  question: Schema.String,
  totalPhases: Schema.Number,
});
export interface StartResultRpc extends Schema.Schema.Type<typeof StartResultRpc> {}

const EvalResultRpc = Schema.Union([
  Schema.TaggedStruct("Advanced", {
    sessionId: SessionIdSchema,
    rule: Schema.String,
    from: PhaseInfoRpc,
    to: PhaseInfoRpc,
    question: Schema.String,
    actions: Schema.optional(Schema.Array(Schema.String)),
  }),
  Schema.TaggedStruct("LoopedBack", {
    sessionId: SessionIdSchema,
    rule: Schema.String,
    from: PhaseInfoRpc,
    to: PhaseInfoRpc,
    question: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct("Completed", {
    sessionId: SessionIdSchema,
    rule: Schema.String,
    from: PhaseInfoRpc,
    actions: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct("Blocked", {
    sessionId: SessionIdSchema,
    guard: Schema.String,
    message: Schema.String,
    from: PhaseInfoRpc,
  }),
]);

export const CompensationResult = Schema.Struct({
  phase: Schema.String,
  action: Schema.String,
  result: Schema.Literals(["success", "failed"]),
});
export interface CompensationResult extends Schema.Schema.Type<typeof CompensationResult> {}

export const FailResultRpc = Schema.Struct({
  compensations: Schema.Array(CompensationResult),
});
export interface FailResultRpc extends Schema.Schema.Type<typeof FailResultRpc> {}

const startSession = Rpc.make("StartSession", {
  payload: Schema.Struct({ task: Schema.NonEmptyString }),
  success: StartResultRpc,
  error: PhaseEngineRpcError,
});

const evalSession = Rpc.make("EvalSession", {
  payload: Schema.Struct({
    reflection: Schema.NonEmptyString,
    sessionId: SessionIdSchema,
    size: Schema.optional(Schema.String),
    confidence: Schema.optional(Schema.Literal("low")),
  }),
  success: EvalResultRpc,
  error: PhaseEngineRpcError,
});

const resumeSession = Rpc.make("ResumeSession", {
  payload: Schema.Struct({ sessionId: SessionIdSchema }),
  success: EvalResultRpc,
  error: PhaseEngineRpcError,
});

const failSession = Rpc.make("FailSession", {
  payload: Schema.Struct({
    sessionId: SessionIdSchema,
    reason: Schema.NonEmptyString,
  }),
  success: FailResultRpc,
  error: PhaseEngineRpcError,
});

export const WebRpcs = RpcGroup.make(
  listSessions,
  getSession,
  getDashboard,
  getPhases,
  healthcheck,
  shutdown,
  getTranscript,
  getGlyphs,
  listProjects,
  registerProject,
  setActiveProject,
  getConfig,
  getGraph,
  startSession,
  evalSession,
  resumeSession,
  failSession,
);
