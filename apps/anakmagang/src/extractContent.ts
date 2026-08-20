import { Array as Arr, pipe } from "effect";

export type ContentBlock = {
  readonly type: string;
  readonly text?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly content?: string | ReadonlyArray<{ readonly type: string; readonly text?: string }>;
};

const basename = (filePath: string): string => {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
};

const truncate = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}...` : s);

const formatToolUse = (name: string, input: unknown): string => {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "Bash":
      return `[Bash] ${truncate(String(i.command ?? ""), 200)}`;
    case "Read": {
      const file = basename(String(i.file_path ?? ""));
      const offset = typeof i.offset === "number" ? i.offset : undefined;
      const limit = typeof i.limit === "number" ? i.limit : undefined;
      const range =
        offset != null && limit != null
          ? `:${offset}-${offset + limit}`
          : offset != null
            ? `:${offset}`
            : "";
      return `[Read] ${file}${range}`;
    }
    case "Grep": {
      const pattern = truncate(String(i.pattern ?? ""), 80);
      const path = i.path != null ? ` path=${i.path}` : "";
      return `[Grep] pattern="${pattern}"${path}`;
    }
    case "Agent": {
      const subType = i.subagent_type != null ? `:${i.subagent_type}` : "";
      const desc = truncate(String(i.description ?? ""), 120);
      return `[Agent${subType}] ${desc}`;
    }
    case "Edit":
      return `[Edit] ${basename(String(i.file_path ?? ""))}`;
    case "Write":
      return `[Write] ${basename(String(i.file_path ?? ""))}`;
    case "Glob": {
      const path = i.path != null ? ` in ${i.path}` : "";
      return `[Glob] ${i.pattern ?? ""}${path}`;
    }
    case "AskUserQuestion":
      return "[AskUserQuestion]";
    case "ToolSearch":
      return `[ToolSearch] ${truncate(String(i.query ?? ""), 100)}`;
    default:
      return `[${name}]`;
  }
};

const extractBlock = (block: ContentBlock): string => {
  switch (block.type) {
    case "text":
      return block.text ?? "";
    case "tool_use":
      return formatToolUse(block.name ?? "unknown", block.input);
    case "tool_result":
      return typeof block.content === "string"
        ? block.content
        : Array.isArray(block.content)
          ? pipe(
              block.content,
              Arr.filter((item) => item.type === "text"),
              Arr.map((item) => item.text ?? ""),
              Arr.join(""),
            )
          : "";
    case "thinking":
      return "";
    default:
      return "";
  }
};

export const extractContent = (content: string | ReadonlyArray<ContentBlock>): string =>
  typeof content === "string"
    ? content
    : pipe(
        content,
        Arr.map(extractBlock),
        Arr.filter((s) => s.length > 0),
        Arr.join("\n"),
      );
