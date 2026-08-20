import { Array as Arr, Match, Option, Predicate, pipe, Schema as S } from "effect";

export interface Heading {
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

export interface CodeBlock {
  readonly language: string;
  readonly content: string;
  readonly line: number;
  readonly lines: readonly string[];
}

export interface Section {
  readonly heading: Heading;
  readonly body: string;
  readonly codeBlocks: readonly CodeBlock[];
}

export interface MarkdownDocument {
  readonly headings: readonly Heading[];
  readonly codeBlocks: readonly CodeBlock[];
  readonly sections: readonly Section[];
  readonly body: string;
}

interface ParseState {
  readonly headings: readonly Heading[];
  readonly codeBlocks: readonly CodeBlock[];
  readonly currentCodeBlock: {
    readonly language: string;
    readonly lines: readonly string[];
    readonly startLine: number;
  } | null;
}

const parseHeading = (line: string) => {
  const m = line.trimStart().match(/^(#{1,6}) (.+)/);
  if (!m) return null;
  const text = (m[2] ?? "").trim();
  return text.length > 0 ? { level: (m[1] ?? "").length, text } : null;
};

const buildSections = (
  lines: readonly string[],
  headings: readonly Heading[],
  codeBlocks: readonly CodeBlock[],
) =>
  headings.map((heading, idx) => {
    const nextHeadingLine = Arr.get(headings, idx + 1).pipe(
      Option.match({ onNone: () => lines.length, onSome: (h) => h.line }),
    );
    const bodyLines = lines.slice(heading.line + 1, nextHeadingLine);
    const sectionBody = bodyLines.join("\n").trim();
    const sectionBlocks = codeBlocks.filter(
      (b) => b.line > heading.line && b.line < nextHeadingLine,
    );
    return { heading, body: sectionBody, codeBlocks: sectionBlocks };
  });

export const parse = (body: string) => {
  const lines = body.split("\n");
  const result = lines.reduce<ParseState>(
    (acc, line, idx) => {
      if (acc.currentCodeBlock !== null) {
        if (line.trimStart().startsWith("```")) {
          const block: CodeBlock = {
            language: acc.currentCodeBlock.language,
            content: acc.currentCodeBlock.lines.join("\n"),
            line: acc.currentCodeBlock.startLine,
            lines: acc.currentCodeBlock.lines,
          };
          return { ...acc, codeBlocks: [...acc.codeBlocks, block], currentCodeBlock: null };
        }
        return {
          ...acc,
          currentCodeBlock: {
            ...acc.currentCodeBlock,
            lines: [...acc.currentCodeBlock.lines, line],
          },
        };
      }

      const trimmed = line.trimStart();
      if (trimmed.startsWith("```")) {
        const language = trimmed.slice(3).trim().split(/\s/)[0] || "";
        return { ...acc, currentCodeBlock: { language, lines: [], startLine: idx } };
      }

      const headingMatch = parseHeading(line);
      if (headingMatch !== null) {
        return { ...acc, headings: [...acc.headings, { ...headingMatch, line: idx }] };
      }

      return acc;
    },
    { headings: [], codeBlocks: [], currentCodeBlock: null },
  );

  const sections = buildSections(lines, result.headings, result.codeBlocks);
  return { headings: result.headings, codeBlocks: result.codeBlocks, sections, body };
};

export const findSections = (doc: MarkdownDocument, search: string) => {
  const lower = search.toLowerCase();
  return doc.sections.filter((s) => s.heading.text.toLowerCase().includes(lower));
};

export const hasSection = (doc: MarkdownDocument, search: string) =>
  findSections(doc, search).length > 0;

export const codeBlocksByLanguage = (doc: MarkdownDocument, ...languages: readonly string[]) =>
  doc.codeBlocks.filter((b) => languages.includes(b.language));

export const shellCodeBlocks = (doc: MarkdownDocument) =>
  codeBlocksByLanguage(doc, "sh", "bash", "shell", "zsh");

export const hasMultiLineCodeBlocks = (doc: MarkdownDocument) =>
  doc.codeBlocks.some((b) => b.lines.length > 1);

export const hasHeadingAtLevel = (doc: MarkdownDocument, level: number) =>
  doc.headings.some((h) => h.level === level);

export const sectionHeaders = (doc: MarkdownDocument) => doc.headings.filter((h) => h.level === 2);

export const hasListItems = (doc: MarkdownDocument) =>
  doc.body.split("\n").some((l) => {
    const trimmed = l.trimStart();
    return pipe(
      (s: string): boolean => s.startsWith("- "),
      Predicate.or((s: string): boolean => s.startsWith("* ")),
      Predicate.or((s: string): boolean => /^\d+\. /.test(s)),
    )(trimmed);
  });

export const containsKeyword = (text: string, keywords: readonly string[]) =>
  keywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));

const absolutePathPrefixes = ["/Users/", "/home/", "/etc/", "C:\\"] as const;

export const isAbsolutePath = (token: string): boolean =>
  absolutePathPrefixes.some((prefix) => token.startsWith(prefix));

export const findAbsolutePaths = (text: string) => {
  const tokens = text.split(/[\s`"'()]+/);
  return tokens.filter(isAbsolutePath);
};

export const findFileReferences = (text: string, prefix: string, suffix: string) => {
  const tokens = text.split(/[\s`"'()]+/);
  return tokens.filter((t) => t.includes(prefix) && t.endsWith(suffix));
};

const SkillNameSchema = S.String.pipe(S.check(S.isPattern(/^[a-z][a-z0-9-]*$/)));

export const isValidSkillName = S.is(SkillNameSchema);

export const hasSecretAssignment = (text: string) => {
  const secretIndicators = [
    "api_key",
    "api-key",
    "apikey",
    "password",
    "passwd",
    "secret",
    "token",
  ] as const;
  const lower = text.toLowerCase();
  return secretIndicators.some((indicator) => {
    const idx = lower.indexOf(indicator);
    if (idx === -1) return false;
    const after = text.slice(idx + indicator.length).trimStart();
    return pipe(
      (s: string): boolean => s.startsWith("="),
      Predicate.or((s: string): boolean => s.startsWith(":")),
      Predicate.and((s: string): boolean => s.includes("'") || s.includes('"')),
    )(after);
  });
};

type _MdNode =
  | { readonly type: "MdHeading"; readonly level: number; readonly text: string }
  | { readonly type: "MdParagraph"; readonly text: string }
  | { readonly type: "MdList"; readonly items: readonly string[]; readonly ordered: boolean }
  | { readonly type: "MdCodeBlock"; readonly language: string; readonly content: string }
  | {
      readonly type: "MdTable";
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

const MdHeadingSchema = S.Struct({
  type: S.Literal("MdHeading"),
  level: S.Number,
  text: S.String,
});

const MdParagraphSchema = S.Struct({
  type: S.Literal("MdParagraph"),
  text: S.String,
});

const MdListSchema = S.Struct({
  type: S.Literal("MdList"),
  items: S.Array(S.String),
  ordered: S.Boolean,
});

const MdCodeBlockSchema = S.Struct({
  type: S.Literal("MdCodeBlock"),
  language: S.String,
  content: S.String,
});

const MdTableSchema = S.Struct({
  type: S.Literal("MdTable"),
  headers: S.Array(S.String),
  rows: S.Array(S.Array(S.String)),
});

export const MdNode: S.Schema<_MdNode> = S.Union([
  MdHeadingSchema,
  MdParagraphSchema,
  MdListSchema,
  MdCodeBlockSchema,
  MdTableSchema,
]);

export type MdNode = S.Schema.Type<typeof MdNode>;

const MdDocumentSchema = S.Struct({
  type: S.Literal("MdDocument"),
  nodes: S.Array(MdNode),
});

export const MdDocumentNode = MdDocumentSchema;
export type MdDocumentNode = S.Schema.Type<typeof MdDocumentNode>;

export const heading = (level: number, text: string): MdNode => ({
  type: "MdHeading",
  level,
  text,
});

export const paragraph = (text: string): MdNode => ({
  type: "MdParagraph",
  text,
});

export const list = (items: readonly string[], ordered = false): MdNode => ({
  type: "MdList",
  items,
  ordered,
});

export const codeBlock = (language: string, content: string): MdNode => ({
  type: "MdCodeBlock",
  language,
  content,
});

export const table = (
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): MdNode => ({
  type: "MdTable",
  headers,
  rows,
});

export const mdDoc = (...nodes: readonly MdNode[]): MdDocumentNode => ({
  type: "MdDocument",
  nodes,
});

const prettyPrintNode = (node: MdNode): string =>
  Match.value(node).pipe(
    Match.when({ type: "MdHeading" }, (n) => "#".repeat(n.level) + " " + n.text),
    Match.when({ type: "MdParagraph" }, (n) => n.text),
    Match.when({ type: "MdList" }, (n) =>
      n.items.map((item, i) => (n.ordered ? `${i + 1}. ${item}` : `- ${item}`)).join("\n"),
    ),
    Match.when({ type: "MdCodeBlock" }, (n) => "```" + n.language + "\n" + n.content + "\n```"),
    Match.when({ type: "MdTable" }, (n) => {
      const escapeCell = (cell: string) => cell.replace(/\|/g, "\\|");
      const headerRow = "| " + n.headers.map(escapeCell).join(" | ") + " |";
      const separator = "|" + n.headers.map(() => "---|").join("");
      const dataRows = n.rows.map((row) => "| " + row.map(escapeCell).join(" | ") + " |");
      return [headerRow, separator, ...dataRows].join("\n");
    }),
    Match.exhaustive,
  );

export const prettyPrintMdDoc = (doc: MdDocumentNode): string =>
  doc.nodes.map(prettyPrintNode).join("\n\n");

const parseTableRow = (line: string): readonly string[] => {
  const cells = line.split("|").map((c) => c.trim());
  const start = cells[0] === "" ? 1 : 0;
  const end = cells[cells.length - 1] === "" ? cells.length - 1 : cells.length;
  return cells.slice(start, end);
};

const isTableSeparator = (line: string): boolean => /^\|[\s\-:|]+\|$/.test(line.trim());

interface ConsumeResult {
  readonly node: MdNode;
  readonly next: number;
}

const consumeCodeBlock = (lines: readonly string[], start: number): ConsumeResult => {
  const lang = Arr.get(lines, start).pipe(
    Option.map((l) => l.trimStart().slice(3).trim().split(/\s/)[0] || ""),
    Option.getOrElse(() => ""),
  );
  const collectContent = (
    i: number,
    acc: readonly string[],
  ): { content: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ content: acc, next: i }),
        onSome: (line) =>
          line.trimStart().startsWith("```")
            ? { content: acc, next: i + 1 }
            : collectContent(i + 1, [...acc, line]),
      }),
    );
  const { content, next } = collectContent(start + 1, []);
  return { node: codeBlock(lang, content.join("\n")), next };
};

const consumeTable = (lines: readonly string[], start: number): ConsumeResult => {
  const collectTableLines = (i: number, acc: readonly string[]): readonly string[] =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => acc,
        onSome: (line) =>
          line.trimStart().startsWith("|") ? collectTableLines(i + 1, [...acc, line]) : acc,
      }),
    );
  const tableLines = collectTableLines(start, []);
  const headers = Arr.head(tableLines).pipe(
    Option.map(parseTableRow),
    Option.getOrElse((): readonly string[] => []),
  );
  const dataStart = Arr.get(tableLines, 1).pipe(
    Option.match({
      onNone: () => 1,
      onSome: (line) => (isTableSeparator(line) ? 2 : 1),
    }),
  );
  const rows = tableLines.slice(dataStart).map(parseTableRow);
  return { node: table(headers, rows), next: start + tableLines.length };
};

const consumeList = (lines: readonly string[], start: number): ConsumeResult => {
  const ordered = Arr.get(lines, start).pipe(
    Option.map((l) => /^\d+\. /.test(l.trimStart())),
    Option.getOrElse(() => false),
  );
  const listPattern = ordered ? /^\d+\. / : /^[-*] /;
  const collectItems = (
    i: number,
    acc: readonly string[],
  ): { items: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ items: acc, next: i }),
        onSome: (line) => {
          const trimmed = line.trimStart();
          return listPattern.test(trimmed)
            ? collectItems(i + 1, [...acc, trimmed.replace(listPattern, "")])
            : { items: acc, next: i };
        },
      }),
    );
  const { items, next } = collectItems(start, []);
  return { node: list(items, ordered), next };
};

const consumeParagraph = (lines: readonly string[], start: number): ConsumeResult => {
  const isBreak = (line: string): boolean => {
    const t = line.trimStart();
    return pipe(
      (s: string): boolean => s === "",
      Predicate.or((_: string): boolean => parseHeading(line) !== null),
      Predicate.or((s: string): boolean => s.startsWith("```")),
      Predicate.or((s: string): boolean => s.startsWith("|")),
      Predicate.or((s: string): boolean => /^(?:[-*] |\d+\. )/.test(s)),
    )(t);
  };
  const collectParaLines = (
    i: number,
    acc: readonly string[],
  ): { paraLines: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ paraLines: acc, next: i }),
        onSome: (line) =>
          isBreak(line) ? { paraLines: acc, next: i } : collectParaLines(i + 1, [...acc, line]),
      }),
    );
  const { paraLines, next } = collectParaLines(start, []);
  return { node: paragraph(paraLines.join("\n")), next };
};

type LineConsumer = (lines: readonly string[], i: number) => ConsumeResult | null;

const tryHeading: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.flatMap((line) => {
      const h = parseHeading(line);
      return h !== null
        ? Option.some({ node: heading(h.level, h.text), next: i + 1 })
        : Option.none();
    }),
    Option.getOrElse(() => null),
  );

const consumers: readonly LineConsumer[] = [
  tryHeading,
  (lines, i) =>
    Arr.get(lines, i).pipe(
      Option.flatMap((line) =>
        line.trimStart().startsWith("```")
          ? Option.some(consumeCodeBlock(lines, i))
          : Option.none(),
      ),
      Option.getOrElse(() => null),
    ),
  (lines, i) =>
    Arr.get(lines, i).pipe(
      Option.flatMap((line) =>
        line.trimStart().startsWith("|") ? Option.some(consumeTable(lines, i)) : Option.none(),
      ),
      Option.getOrElse(() => null),
    ),
  (lines, i) =>
    Arr.get(lines, i).pipe(
      Option.flatMap((line) =>
        /^(?:[-*] |\d+\. )/.test(line.trimStart())
          ? Option.some(consumeList(lines, i))
          : Option.none(),
      ),
      Option.getOrElse(() => null),
    ),
];

const dispatch = (lines: readonly string[], i: number): ConsumeResult =>
  consumers.reduce<ConsumeResult | null>((found, consumer) => found ?? consumer(lines, i), null) ??
  consumeParagraph(lines, i);

export const parseToAst = (input: string): MdDocumentNode => {
  const lines = input.split("\n");

  const accumulate = (i: number, nodes: readonly MdNode[]): readonly MdNode[] =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => nodes,
        onSome: (line) => {
          if (line.trim() === "") return accumulate(i + 1, nodes);
          const result = dispatch(lines, i);
          return accumulate(result.next, [...nodes, result.node]);
        },
      }),
    );

  return mdDoc(...accumulate(0, []));
};

export const fromAst = prettyPrintMdDoc;
