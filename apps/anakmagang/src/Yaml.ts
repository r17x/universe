import { Array as Arr, Match, Option, Predicate, Result, pipe, Schema as S } from "effect";

type _YamlValue =
  | { readonly type: "YamlScalar"; readonly value: string | number | boolean | null }
  | { readonly type: "YamlList"; readonly items: readonly _YamlValue[] }
  | {
      readonly type: "YamlMap";
      readonly entries: readonly { readonly key: string; readonly value: _YamlValue }[];
    };

const YamlScalarSchema = S.Struct({
  type: S.Literal("YamlScalar"),
  value: S.Union([S.String, S.Number, S.Boolean, S.Null]),
});

const YamlListSchema = S.Struct({
  type: S.Literal("YamlList"),
  items: S.Array(S.suspend((): S.Schema<_YamlValue> => YamlValue)),
});

const YamlMapSchema = S.Struct({
  type: S.Literal("YamlMap"),
  entries: S.Array(
    S.Struct({
      key: S.String,
      value: S.suspend((): S.Schema<_YamlValue> => YamlValue),
    }),
  ),
});

const YamlDocumentSchema = S.Struct({
  type: S.Literal("YamlDocument"),
  content: S.suspend((): S.Schema<_YamlValue> => YamlValue),
  comment: S.optionalKey(S.String),
});

export const YamlValue: S.Schema<_YamlValue> = S.Union([
  YamlScalarSchema,
  YamlListSchema,
  YamlMapSchema,
]);
export const YamlDocument = YamlDocumentSchema;

export type YamlValue = S.Schema.Type<typeof YamlValue>;
export type YamlDocument = S.Schema.Type<typeof YamlDocument>;

export const scalar = (value: string | number | boolean | null): YamlValue => ({
  type: "YamlScalar",
  value,
});

export const list = (items: ReadonlyArray<YamlValue>): YamlValue => ({
  type: "YamlList",
  items,
});

export const map = (entries: ReadonlyArray<{ key: string; value: YamlValue }>): YamlValue => ({
  type: "YamlMap",
  entries,
});

export const doc = (content: YamlValue, comment?: string): YamlDocument => ({
  type: "YamlDocument",
  content,
  ...(comment !== undefined ? { comment } : {}),
});

const YAML_SPECIAL_CHARS = /[:#{}"'*&![\]{},|>%@`\n]/;

const needsQuoting = pipe(
  (v: string): boolean => v === "",
  Predicate.or((v: string): boolean => YAML_SPECIAL_CHARS.test(v)),
  Predicate.or((v: string): boolean => v === "true" || v === "false" || v === "null"),
  Predicate.or((v: string): boolean => /^\d/.test(v)),
  Predicate.or((v: string): boolean => /^[-?]/.test(v)),
);

const escapeYamlString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const formatScalar = (value: string | number | boolean | null): string =>
  value === null
    ? "null"
    : typeof value !== "string"
      ? String(value)
      : needsQuoting(value)
        ? escapeYamlString(value)
        : value;

const prettyPrintValue = (value: YamlValue, indent = 0): string => {
  const spaces = "  ".repeat(indent);

  return Match.value(value).pipe(
    Match.when({ type: "YamlScalar" }, (node) => formatScalar(node.value)),
    Match.when({ type: "YamlList" }, (node) =>
      node.items.length === 0
        ? "[]"
        : node.items
            .map((item) => `${spaces}- ${prettyPrintValue(item, indent + 1).trim()}`)
            .join("\n"),
    ),
    Match.when({ type: "YamlMap" }, (node) =>
      node.entries.length === 0
        ? "{}"
        : node.entries
            .map(({ key, value: v }) => {
              const valueStr = prettyPrintValue(v, indent + 1);
              const isBlock =
                (v.type === "YamlList" && v.items.length > 0) ||
                (v.type === "YamlMap" && v.entries.length > 0);
              return isBlock
                ? `${spaces}${key}:\n${valueStr}`
                : `${spaces}${key}: ${valueStr.trim()}`;
            })
            .join("\n"),
    ),
    Match.exhaustive,
  );
};

export const prettyPrintDoc = (document: YamlDocument) =>
  (document.comment !== undefined ? `# ${document.comment}\n` : "") +
  prettyPrintValue(document.content, 0);

export const serializeFrontmatter = (
  entries: ReadonlyArray<{ key: string; value: YamlValue }>,
  body: string,
) => `---\n${prettyPrintValue(map(entries), 0)}\n---\n${body}`;

interface QuoteState {
  readonly inSingle: boolean;
  readonly inDouble: boolean;
}

const initialQuoteState: QuoteState = { inSingle: false, inDouble: false };

const advanceQuoteState = (state: QuoteState, ch: string, prev: string) =>
  ch === "'" && !state.inDouble
    ? { ...state, inSingle: !state.inSingle }
    : ch === '"' && !state.inSingle && prev !== "\\"
      ? { ...state, inDouble: !state.inDouble }
      : state;

const stripComment = (line: string) => {
  const walkChars = (idx: number, state: QuoteState): string => {
    if (idx >= line.length) return line;
    const ch = line.charAt(idx);
    const prev = idx > 0 ? line.charAt(idx - 1) : "";
    const nextState = advanceQuoteState(state, ch, prev);
    if (
      ch === "#" &&
      !nextState.inSingle &&
      !nextState.inDouble &&
      (idx === 0 || line[idx - 1] === " ")
    )
      return line.slice(0, idx).trimEnd();
    return walkChars(idx + 1, nextState);
  };
  return walkChars(0, initialQuoteState);
};

const parseFlowSequence = (raw: string): unknown[] | null => {
  if (!raw.startsWith("[") || !raw.endsWith("]")) return null;
  const inner = raw.slice(1, -1).trim();
  if (inner === "") return [];
  const result = inner.split("").reduce<{ items: unknown[]; current: string; state: QuoteState }>(
    (acc, ch, i) => {
      const prev = i > 0 ? inner.charAt(i - 1) : "";
      const nextState = advanceQuoteState(acc.state, ch, prev);
      if (ch === "," && !nextState.inSingle && !nextState.inDouble) {
        return {
          state: nextState,
          items: [...acc.items, parseScalar(acc.current.trim())],
          current: "",
        };
      }
      return { state: nextState, items: acc.items, current: acc.current + ch };
    },
    { items: [], current: "", state: initialQuoteState },
  );
  return result.current.trim() !== ""
    ? [...result.items, parseScalar(result.current.trim())]
    : result.items;
};

const scalarLiterals = new Map<string, unknown>([
  ["", null],
  ["null", null],
  ["~", null],
  ["true", true],
  ["false", false],
  ["[]", []],
  ["{}", {}],
]);

const unquote = (raw: string): string | undefined =>
  raw.startsWith('"') && raw.endsWith('"')
    ? raw
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
    : raw.startsWith("'") && raw.endsWith("'")
      ? raw.slice(1, -1).replace(/''/g, "'")
      : undefined;

const tryNumber = (raw: string): number | undefined => {
  const num = Number(raw);
  return !Number.isNaN(num) && raw !== "" ? num : undefined;
};

const parseScalar = (raw: string): unknown =>
  scalarLiterals.has(raw)
    ? scalarLiterals.get(raw)
    : (parseFlowSequence(raw) ?? unquote(raw) ?? tryNumber(raw) ?? raw);

interface ParsedLine {
  readonly indent: number;
  readonly content: string;
}

const prepareLines = (input: string) =>
  pipe(
    input.split("\n"),
    Arr.filterMap((rawLine) => {
      const trimmed = rawLine.trimStart();
      if (trimmed === "" || trimmed.startsWith("#")) return Result.failVoid;
      const content = stripComment(trimmed);
      if (content === "") return Result.failVoid;
      const indent = rawLine.length - trimmed.length;
      return Result.succeed({ indent, content });
    }),
  );

const findTopLevelColon = (s: string) => {
  const walk = (idx: number, state: QuoteState): number => {
    if (idx >= s.length) return -1;
    const ch = s.charAt(idx);
    const prev = idx > 0 ? s.charAt(idx - 1) : "";
    const nextState = advanceQuoteState(state, ch, prev);
    if (
      ch === ":" &&
      !nextState.inSingle &&
      !nextState.inDouble &&
      (idx + 1 === s.length || s[idx + 1] === " ")
    )
      return idx;
    return walk(idx + 1, nextState);
  };
  return walk(0, initialQuoteState);
};

interface ParseResult {
  readonly value: unknown;
  readonly next: number;
}

const parseBlock = (
  lines: ReadonlyArray<ParsedLine>,
  start: number,
  baseIndent: number,
): ParseResult =>
  Arr.get(lines, start).pipe(
    Option.filter((line) => line.indent >= baseIndent),
    Option.match({
      onNone: () => ({ value: null, next: start }),
      onSome: (line) => {
        if (line.content.startsWith("- ") || line.content === "-") {
          return parseSequence(lines, start, line.indent);
        }

        const colonIdx = findTopLevelColon(line.content);
        if (colonIdx !== -1) {
          return parseMapping(lines, start, line.indent);
        }

        return { value: parseScalar(line.content), next: start + 1 };
      },
    }),
  );

const parseMapping = (
  lines: ReadonlyArray<ParsedLine>,
  start: number,
  baseIndent: number,
): ParseResult => {
  const accumulate = (
    idx: number,
    entries: ReadonlyArray<readonly [string, unknown]>,
  ): ParseResult => {
    const done = { value: Object.fromEntries(entries), next: idx };
    return Arr.get(lines, idx).pipe(
      Option.filter((line) => line.indent === baseIndent),
      Option.map((line) => ({ line, colonIdx: findTopLevelColon(line.content) })),
      Option.filter(({ colonIdx }) => colonIdx !== -1),
      Option.match({
        onNone: () => done,
        onSome: ({ line, colonIdx }) => {
          const key = line.content.slice(0, colonIdx).trim();
          const afterColon = line.content.slice(colonIdx + 1).trim();

          if (afterColon !== "") {
            return accumulate(idx + 1, [...entries, [key, parseScalar(afterColon)]]);
          }

          const nextIdx = idx + 1;
          return Arr.get(lines, nextIdx).pipe(
            Option.filter((nextLine) => nextLine.indent > baseIndent),
            Option.match({
              onNone: () => accumulate(nextIdx, [...entries, [key, null]]),
              onSome: (nextLine) => {
                const sub = parseBlock(lines, nextIdx, nextLine.indent);
                return accumulate(sub.next, [...entries, [key, sub.value]]);
              },
            }),
          );
        },
      }),
    );
  };

  return accumulate(start, []);
};

const parseSequence = (
  lines: ReadonlyArray<ParsedLine>,
  start: number,
  baseIndent: number,
): ParseResult => {
  const accumulate = (idx: number, items: ReadonlyArray<unknown>): ParseResult => {
    const done = { value: items, next: idx };
    return Arr.get(lines, idx).pipe(
      Option.filter((line) => line.indent === baseIndent && line.content.startsWith("-")),
      Option.match({
        onNone: () => done,
        onSome: (line) => {
          if (line.content === "-") {
            const nextIdx = idx + 1;
            return Arr.get(lines, nextIdx).pipe(
              Option.filter((nextLine) => nextLine.indent > baseIndent),
              Option.match({
                onNone: () => accumulate(nextIdx, [...items, null]),
                onSome: (nextLine) => {
                  const sub = parseBlock(lines, nextIdx, nextLine.indent);
                  return accumulate(sub.next, [...items, sub.value]);
                },
              }),
            );
          }

          const itemContent = line.content.slice(2);
          const itemColonIdx = findTopLevelColon(itemContent);

          if (itemColonIdx !== -1) {
            const collectNested = (
              j: number,
              acc: ReadonlyArray<ParsedLine>,
            ): ReadonlyArray<ParsedLine> =>
              Arr.get(lines, j).pipe(
                Option.filter((jLine) => jLine.indent > baseIndent),
                Option.match({
                  onNone: () => acc,
                  onSome: (jLine) => collectNested(j + 1, [...acc, jLine]),
                }),
              );

            const nestedLines = collectNested(idx + 1, []);
            const virtualLines: ReadonlyArray<ParsedLine> = [
              { indent: baseIndent + 2, content: itemContent },
              ...nestedLines,
            ];
            const sub = parseBlock(virtualLines, 0, baseIndent + 2);
            return accumulate(idx + 1 + nestedLines.length, [...items, sub.value]);
          }

          return accumulate(idx + 1, [...items, parseScalar(itemContent)]);
        },
      }),
    );
  };

  return accumulate(start, []);
};

export const parse = (input: string) => {
  const lines = prepareLines(input);
  return Arr.head(lines).pipe(
    Option.match({
      onNone: () => null,
      onSome: (first) => parseBlock(lines, 0, first.indent).value,
    }),
  );
};

export const toAst = (value: unknown): YamlValue =>
  value === null
    ? scalar(null)
    : typeof value === "string"
      ? scalar(value)
      : typeof value === "number"
        ? scalar(value)
        : typeof value === "boolean"
          ? scalar(value)
          : Array.isArray(value)
            ? list(value.map(toAst))
            : typeof value === "object"
              ? map(Object.entries(value).map(([k, v]) => ({ key: k, value: toAst(v) })))
              : scalar(null);

export const fromAst = (ast: YamlValue): unknown =>
  Match.value(ast).pipe(
    Match.when({ type: "YamlScalar" }, (node) => node.value),
    Match.when({ type: "YamlList" }, (node) => node.items.map(fromAst)),
    Match.when({ type: "YamlMap" }, (node) =>
      Object.fromEntries(node.entries.map((e) => [e.key, fromAst(e.value)])),
    ),
    Match.exhaustive,
  );

export const parseToAst = (input: string): YamlValue | null => {
  const raw = parse(input);
  return raw === null ? null : toAst(raw);
};

export const quoteYaml = (value: string) =>
  needsQuoting(value)
    ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
    : value;

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export const parseFrontmatter = (content: string) => {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (match === null) return null;
  const parsed = parse(match[1] ?? "");
  return isRecord(parsed) ? { fm: parsed, body: (match[2] ?? "").trim() } : null;
};
