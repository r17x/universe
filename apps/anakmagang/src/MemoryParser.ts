import { Clock, Effect } from "effect";
import * as Schema from "effect/Schema";
import * as Yaml from "./Yaml";

export interface MemoryNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: "user" | "feedback" | "project" | "reference";
  readonly scale: "observation" | "finding" | "learning" | "principle";
  readonly state: "ACTIVE" | "STALE" | "ARCHIVED";
  readonly updated: string;
  readonly session_count: number;
  readonly edges: { readonly derived_from: readonly string[] };
  readonly tags: readonly string[];
  readonly body: string;
  readonly source: "permanent" | "ephemeral";
}

export interface MemoryNodeInput {
  readonly name: string;
  readonly description: string;
  readonly type: "user" | "feedback" | "project" | "reference";
  readonly scale?: "observation" | "finding" | "learning" | "principle" | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly body?: string | undefined;
  readonly source?: "permanent" | "ephemeral" | undefined;
}

export interface MemoryFilter {
  readonly tag?: string | undefined;
  readonly scale?: string | undefined;
  readonly state?: string | undefined;
  readonly text?: string | undefined;
  readonly source?: string | undefined;
}

export interface MemoryStatus {
  readonly total: number;
  readonly byState: Record<string, number>;
  readonly byScale: Record<string, number>;
  readonly byType: Record<string, number>;
  readonly bySource: Record<string, number>;
}

export class MemoryNodeError extends Schema.TaggedErrorClass<MemoryNodeError>()("MemoryNodeError", {
  id: Schema.String,
  message: Schema.String,
}) {}

export const scaleOrder = ["observation", "finding", "learning", "principle"] as const;

const emptyStringArray: readonly string[] = [];

export const MemoryNodeFrontmatter = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
  description: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
  type: Schema.Literals(["user", "feedback", "project", "reference"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("project" as const)),
  ),
  scale: Schema.Literals(["observation", "finding", "learning", "principle"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("observation" as const)),
  ),
  state: Schema.Literals(["ACTIVE", "STALE", "ARCHIVED"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("ACTIVE" as const)),
  ),
  updated: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
  session_count: Schema.Number.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  edges: Schema.Struct({
    derived_from: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed(emptyStringArray)),
    ),
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed({ derived_from: emptyStringArray }))),
  tags: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(emptyStringArray)),
  ),
  source: Schema.Literals(["permanent", "ephemeral"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("permanent" as const)),
  ),
});

export const toId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const todayString = Effect.map(Clock.currentTimeMillis, (ms) => {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
});

export const parseMemoryFrontmatter = (
  content: string,
  id: string,
): Effect.Effect<MemoryNode, MemoryNodeError> =>
  Effect.gen(function* () {
    const result = Yaml.parseFrontmatter(content);
    if (result === null) {
      return yield* new MemoryNodeError({
        id,
        message: "Invalid frontmatter: missing --- delimiters or unparseable YAML",
      });
    }
    const fm = yield* Schema.decodeUnknownEffect(MemoryNodeFrontmatter)(result.fm).pipe(
      Effect.mapError(
        () => new MemoryNodeError({ id, message: "Frontmatter schema validation failed" }),
      ),
    );
    return {
      id: fm.id ?? id,
      name: fm.name,
      description: fm.description,
      type: fm.type,
      scale: fm.scale,
      state: fm.state,
      updated: fm.updated,
      session_count: fm.session_count,
      edges: { derived_from: fm.edges.derived_from },
      tags: fm.tags,
      body: result.body,
      source: fm.source,
    };
  });

export const serializeNode = (node: MemoryNode) =>
  Yaml.serializeFrontmatter(
    [
      { key: "id", value: Yaml.scalar(node.id) },
      { key: "name", value: Yaml.scalar(node.name) },
      { key: "description", value: Yaml.scalar(node.description) },
      { key: "type", value: Yaml.scalar(node.type) },
      { key: "scale", value: Yaml.scalar(node.scale) },
      { key: "state", value: Yaml.scalar(node.state) },
      { key: "updated", value: Yaml.scalar(node.updated) },
      { key: "session_count", value: Yaml.scalar(node.session_count) },
      {
        key: "edges",
        value: Yaml.map([
          {
            key: "derived_from",
            value: Yaml.list(node.edges.derived_from.map((s) => Yaml.scalar(s))),
          },
        ]),
      },
      { key: "tags", value: Yaml.list(node.tags.map((s) => Yaml.scalar(s))) },
      { key: "source", value: Yaml.scalar(node.source) },
    ],
    node.body,
  );

export const matchesFilter = (node: MemoryNode, filter: MemoryFilter) => {
  if (filter.source !== undefined && node.source !== filter.source) return false;
  if (filter.tag !== undefined && !node.tags.includes(filter.tag)) return false;
  if (filter.scale !== undefined && node.scale !== filter.scale) return false;
  if (filter.state !== undefined && node.state !== filter.state) return false;
  if (filter.text !== undefined) {
    const lower = filter.text.toLowerCase();
    const haystack = `${node.name} ${node.description} ${node.body}`.toLowerCase();
    if (!haystack.includes(lower)) return false;
  }
  return true;
};

export const increment = (rec: Record<string, number>, key: string) => ({
  ...rec,
  [key]: (rec[key] ?? 0) + 1,
});
