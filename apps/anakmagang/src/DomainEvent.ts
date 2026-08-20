import { Data, Match, Schema } from "effect";
import type { SessionId } from "./Ulid";
import { SessionIdSchema } from "./Ulid";

export type DomainEvent = Data.TaggedEnum<{
  GuardFired: {
    readonly sessionId: SessionId;
    readonly guard: string;
    readonly decision: string;
    readonly message: string;
    readonly timestamp: string;
  };
  PhaseAdvanced: {
    readonly sessionId: SessionId;
    readonly from: string;
    readonly to: string;
    readonly reflection: string;
    readonly timestamp: string;
  };
  Observed: {
    readonly sessionId: SessionId;
    readonly text: string;
    readonly timestamp: string;
  };
  TranscriptMessage: {
    readonly sessionId: SessionId;
    readonly provider: string;
    readonly providerSessionId: string;
    readonly role: string;
    readonly content: string;
    readonly timestamp: string;
  };
  FileChanged: {
    readonly sessionId: SessionId;
    readonly path: string;
    readonly action: string;
    readonly timestamp: string;
  };
  SessionStarted: {
    readonly sessionId: SessionId;
    readonly task: string;
    readonly timestamp: string;
  };
  SessionCompleted: {
    readonly sessionId: SessionId;
    readonly timestamp: string;
  };
  Heartbeat: {
    readonly timestamp: string;
  };
  ProjectRegistered: {
    readonly projectId: string;
    readonly projectName: string;
    readonly timestamp: string;
  };
}>;

export const {
  GuardFired,
  PhaseAdvanced,
  Observed,
  TranscriptMessage,
  FileChanged,
  SessionStarted,
  SessionCompleted,
  Heartbeat,
  ProjectRegistered,
  $is,
  $match,
} = Data.taggedEnum<DomainEvent>();

export const DomainEventSchema = Schema.Union([
  Schema.TaggedStruct("GuardFired", {
    sessionId: SessionIdSchema,
    guard: Schema.String,
    decision: Schema.String,
    message: Schema.String,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("PhaseAdvanced", {
    sessionId: SessionIdSchema,
    from: Schema.String,
    to: Schema.String,
    reflection: Schema.String,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("Observed", {
    sessionId: SessionIdSchema,
    text: Schema.String,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("TranscriptMessage", {
    sessionId: SessionIdSchema,
    provider: Schema.String,
    providerSessionId: Schema.String,
    role: Schema.String,
    content: Schema.String,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("FileChanged", {
    sessionId: SessionIdSchema,
    path: Schema.String,
    action: Schema.String,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("SessionStarted", {
    sessionId: SessionIdSchema,
    task: Schema.String,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("SessionCompleted", {
    sessionId: SessionIdSchema,
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("Heartbeat", {
    timestamp: Schema.String,
  }),
  Schema.TaggedStruct("ProjectRegistered", {
    projectId: Schema.String,
    projectName: Schema.String,
    timestamp: Schema.String,
  }),
]);

export const eventSessionId: (event: DomainEvent) => SessionId | undefined =
  Match.type<DomainEvent>().pipe(
    Match.tagsExhaustive({
      GuardFired: (_) => _.sessionId,
      PhaseAdvanced: (_) => _.sessionId,
      Observed: (_) => _.sessionId,
      TranscriptMessage: (_) => _.sessionId,
      FileChanged: (_) => _.sessionId,
      SessionStarted: (_) => _.sessionId,
      SessionCompleted: (_) => _.sessionId,
      Heartbeat: () => undefined,
      ProjectRegistered: () => undefined,
    }),
  );

const eventType: (event: DomainEvent) => string = $match({
  GuardFired: () => "guard_fired",
  PhaseAdvanced: () => "phase_advanced",
  Observed: () => "observed",
  TranscriptMessage: () => "transcript",
  FileChanged: () => "file_changed",
  SessionStarted: () => "session_started",
  SessionCompleted: () => "session_completed",
  Heartbeat: () => "heartbeat",
  ProjectRegistered: () => "project_registered",
});

export const formatSSE = (event: DomainEvent): string => {
  const type = eventType(event);
  const sessionId = eventSessionId(event) ?? "system";
  const { _tag: _, ...data } = event;
  const id = `${sessionId}-${data.timestamp}`;
  const json = JSON.stringify(data);
  return `event: ${type}\nid: ${id}\ndata: ${json}\n\n`;
};
