import { Array as Arr, Match, Option, Schema as S } from "effect";

type _MetaEntry = { readonly key: string; readonly value: string };

type _NorgNode =
  | { readonly type: "NorgHeading"; readonly level: number; readonly text: string }
  | { readonly type: "NorgParagraph"; readonly text: string }
  | { readonly type: "NorgList"; readonly items: readonly string[]; readonly ordered: boolean }
  | { readonly type: "NorgCodeBlock"; readonly language: string; readonly content: string }
  | { readonly type: "NorgQuote"; readonly content: string }
  | { readonly type: "NorgDefinition"; readonly term: string; readonly body: string }
  | {
      readonly type: "NorgTag";
      readonly name: string;
      readonly parameters: string;
      readonly content: string;
      readonly verbatim: boolean;
    }
  | { readonly type: "NorgHorizontalRule" }
  | { readonly type: "NorgMeta"; readonly entries: readonly _MetaEntry[] };

const MetaEntrySchema = S.Struct({ key: S.String, value: S.String });

const NorgHeadingSchema = S.Struct({
  type: S.Literal("NorgHeading"),
  level: S.Number,
  text: S.String,
});

const NorgParagraphSchema = S.Struct({
  type: S.Literal("NorgParagraph"),
  text: S.String,
});

const NorgListSchema = S.Struct({
  type: S.Literal("NorgList"),
  items: S.Array(S.String),
  ordered: S.Boolean,
});

const NorgCodeBlockSchema = S.Struct({
  type: S.Literal("NorgCodeBlock"),
  language: S.String,
  content: S.String,
});

const NorgQuoteSchema = S.Struct({
  type: S.Literal("NorgQuote"),
  content: S.String,
});

const NorgDefinitionSchema = S.Struct({
  type: S.Literal("NorgDefinition"),
  term: S.String,
  body: S.String,
});

const NorgTagSchema = S.Struct({
  type: S.Literal("NorgTag"),
  name: S.String,
  parameters: S.String,
  content: S.String,
  verbatim: S.Boolean,
});

const NorgHorizontalRuleSchema = S.Struct({
  type: S.Literal("NorgHorizontalRule"),
});

const NorgMetaSchema = S.Struct({
  type: S.Literal("NorgMeta"),
  entries: S.Array(MetaEntrySchema),
});

export const NorgNode: S.Schema<_NorgNode> = S.Union([
  NorgHeadingSchema,
  NorgParagraphSchema,
  NorgListSchema,
  NorgCodeBlockSchema,
  NorgQuoteSchema,
  NorgDefinitionSchema,
  NorgTagSchema,
  NorgHorizontalRuleSchema,
  NorgMetaSchema,
]);

export type NorgNode = S.Schema.Type<typeof NorgNode>;

const NorgDocumentSchema = S.Struct({
  type: S.Literal("NorgDocument"),
  nodes: S.Array(NorgNode),
  meta: S.optionalKey(NorgMetaSchema),
});

export const NorgDocument = NorgDocumentSchema;
export type NorgDocument = S.Schema.Type<typeof NorgDocument>;

export const heading = (level: number, text: string): NorgNode => ({
  type: "NorgHeading",
  level,
  text,
});

export const paragraph = (text: string): NorgNode => ({
  type: "NorgParagraph",
  text,
});

export const list = (items: readonly string[], ordered = false): NorgNode => ({
  type: "NorgList",
  items,
  ordered,
});

export const codeBlock = (language: string, content: string): NorgNode => ({
  type: "NorgCodeBlock",
  language,
  content,
});

export const quote = (content: string): NorgNode => ({
  type: "NorgQuote",
  content,
});

export const definition = (term: string, body: string): NorgNode => ({
  type: "NorgDefinition",
  term,
  body,
});

export const tag = (
  name: string,
  parameters: string,
  content: string,
  verbatim: boolean,
): NorgNode => ({
  type: "NorgTag",
  name,
  parameters,
  content,
  verbatim,
});

export const horizontalRule = (): NorgNode => ({
  type: "NorgHorizontalRule",
});

export const meta = (entries: readonly _MetaEntry[]): NorgNode => ({
  type: "NorgMeta",
  entries,
});

export const norgDoc = (nodes: readonly NorgNode[], docMeta?: NorgNode): NorgDocument => ({
  type: "NorgDocument",
  nodes,
  ...(docMeta !== undefined && docMeta.type === "NorgMeta" ? { meta: docMeta } : {}),
});

interface ConsumeResult {
  readonly node: NorgNode;
  readonly next: number;
}

const parseHeadingLevel = (line: string): { level: number; text: string } | null => {
  const m = line.match(/^(\*+)\s+(.+)/);
  if (!m) return null;
  return { level: (m[1] ?? "").length, text: (m[2] ?? "").trim() };
};

const consumeMeta = (lines: readonly string[], start: number): ConsumeResult => {
  const collectEntries = (
    i: number,
    acc: readonly _MetaEntry[],
  ): { entries: readonly _MetaEntry[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ entries: acc, next: i }),
        onSome: (line) => {
          const trimmed = line.trim();
          if (trimmed === "@end") return { entries: acc, next: i + 1 };
          const colonIdx = trimmed.indexOf(":");
          if (colonIdx !== -1) {
            const key = trimmed.slice(0, colonIdx).trim();
            const value = trimmed.slice(colonIdx + 1).trim();
            return collectEntries(i + 1, Arr.append(acc, { key, value }));
          }
          return collectEntries(i + 1, acc);
        },
      }),
    );
  const { entries, next } = collectEntries(start + 1, []);
  return { node: meta(entries), next };
};

const consumeCodeBlock = (lines: readonly string[], start: number): ConsumeResult =>
  Arr.get(lines, start).pipe(
    Option.match({
      onNone: () => ({ node: codeBlock("", ""), next: start }),
      onSome: (startLine) => {
        const rest = startLine.slice(5).trim();
        const lang = rest.split(/\s/)[0] || "";
        const collectContent = (
          i: number,
          acc: readonly string[],
        ): { content: readonly string[]; next: number } =>
          Arr.get(lines, i).pipe(
            Option.match({
              onNone: () => ({ content: acc, next: i }),
              onSome: (line) => {
                if (line.trim() === "@end") return { content: acc, next: i + 1 };
                return collectContent(i + 1, Arr.append(acc, line));
              },
            }),
          );
        const { content, next } = collectContent(start + 1, []);
        return { node: codeBlock(lang, content.join("\n")), next };
      },
    }),
  );

const consumeVerbatimTag = (lines: readonly string[], start: number): ConsumeResult =>
  Arr.get(lines, start).pipe(
    Option.match({
      onNone: () => ({ node: tag("", "", "", true), next: start }),
      onSome: (startLine) => {
        const afterAt = startLine.slice(1).trim();
        const spaceIdx = afterAt.indexOf(" ");
        const name = spaceIdx === -1 ? afterAt : afterAt.slice(0, spaceIdx);
        const parameters = spaceIdx === -1 ? "" : afterAt.slice(spaceIdx + 1).trim();
        const collectContent = (
          i: number,
          acc: readonly string[],
        ): { content: readonly string[]; next: number } =>
          Arr.get(lines, i).pipe(
            Option.match({
              onNone: () => ({ content: acc, next: i }),
              onSome: (line) => {
                if (line.trim() === "@end") return { content: acc, next: i + 1 };
                return collectContent(i + 1, Arr.append(acc, line));
              },
            }),
          );
        const { content, next } = collectContent(start + 1, []);
        return { node: tag(name, parameters, content.join("\n"), true), next };
      },
    }),
  );

const consumeStandardTag = (lines: readonly string[], start: number): ConsumeResult =>
  Arr.get(lines, start).pipe(
    Option.match({
      onNone: () => ({ node: tag("", "", "", false), next: start }),
      onSome: (startLine) => {
        const afterPipe = startLine.slice(1).trim();
        const spaceIdx = afterPipe.indexOf(" ");
        const name = spaceIdx === -1 ? afterPipe : afterPipe.slice(0, spaceIdx);
        const parameters = spaceIdx === -1 ? "" : afterPipe.slice(spaceIdx + 1).trim();
        const collectContent = (
          i: number,
          acc: readonly string[],
        ): { content: readonly string[]; next: number } =>
          Arr.get(lines, i).pipe(
            Option.match({
              onNone: () => ({ content: acc, next: i }),
              onSome: (line) => {
                if (line.trim() === "|end") return { content: acc, next: i + 1 };
                return collectContent(i + 1, Arr.append(acc, line));
              },
            }),
          );
        const { content, next } = collectContent(start + 1, []);
        return { node: tag(name, parameters, content.join("\n"), false), next };
      },
    }),
  );

const consumeUnorderedList = (lines: readonly string[], start: number): ConsumeResult => {
  const collectItems = (
    i: number,
    acc: readonly string[],
  ): { items: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ items: acc, next: i }),
        onSome: (line) => {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith("- ")) return { items: acc, next: i };
          const itemText = trimmed.slice(2).replace(/^\([x -]\)\s*/, "");
          return collectItems(i + 1, Arr.append(acc, itemText));
        },
      }),
    );
  const { items, next } = collectItems(start, []);
  return { node: list(items, false), next };
};

const consumeOrderedList = (lines: readonly string[], start: number): ConsumeResult => {
  const collectItems = (
    i: number,
    acc: readonly string[],
  ): { items: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ items: acc, next: i }),
        onSome: (line) => {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith("~ ")) return { items: acc, next: i };
          return collectItems(i + 1, Arr.append(acc, trimmed.slice(2)));
        },
      }),
    );
  const { items, next } = collectItems(start, []);
  return { node: list(items, true), next };
};

const consumeQuote = (lines: readonly string[], start: number): ConsumeResult => {
  const collectLines = (
    i: number,
    acc: readonly string[],
  ): { quoteLines: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ quoteLines: acc, next: i }),
        onSome: (line) => {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith("> ")) return { quoteLines: acc, next: i };
          return collectLines(i + 1, Arr.append(acc, trimmed.slice(2)));
        },
      }),
    );
  const { quoteLines, next } = collectLines(start, []);
  return { node: quote(quoteLines.join("\n")), next };
};

const consumeDefinition = (lines: readonly string[], start: number): ConsumeResult =>
  Arr.get(lines, start).pipe(
    Option.match({
      onNone: () => ({ node: definition("", ""), next: start }),
      onSome: (startLine) => {
        const term = startLine.trimStart().slice(2).trim();
        const collectBody = (
          i: number,
          acc: readonly string[],
        ): { bodyLines: readonly string[]; next: number } =>
          Arr.get(lines, i).pipe(
            Option.match({
              onNone: () => ({ bodyLines: acc, next: i }),
              onSome: (line) => {
                const trimmed = line.trim();
                if (trimmed === "" && acc.length > 0) return { bodyLines: acc, next: i };
                if (trimmed === "") return collectBody(i + 1, acc);
                if (parseHeadingLevel(line) !== null) return { bodyLines: acc, next: i };
                if (trimmed.startsWith("$ ")) return { bodyLines: acc, next: i };
                if (trimmed.startsWith("@") || trimmed.startsWith("|") || /^-{3,}$/.test(trimmed))
                  return { bodyLines: acc, next: i };
                return collectBody(i + 1, Arr.append(acc, line));
              },
            }),
          );
        const { bodyLines, next } = collectBody(start + 1, []);
        return { node: definition(term, bodyLines.join("\n").trim()), next };
      },
    }),
  );

const consumeParagraph = (lines: readonly string[], start: number): ConsumeResult => {
  const isBreak = (line: string): boolean => {
    const t = line.trimStart();
    return (
      t === "" ||
      parseHeadingLevel(line) !== null ||
      t.startsWith("@") ||
      (t.startsWith("|") && t !== "|" && !t.startsWith("| ")) ||
      t.startsWith("- ") ||
      t.startsWith("~ ") ||
      t.startsWith("> ") ||
      t.startsWith("$ ") ||
      /^-{3,}$/.test(t)
    );
  };
  const collectLines = (
    i: number,
    acc: readonly string[],
  ): { paraLines: readonly string[]; next: number } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ paraLines: acc, next: i }),
        onSome: (line) =>
          isBreak(line) ? { paraLines: acc, next: i } : collectLines(i + 1, Arr.append(acc, line)),
      }),
    );
  const { paraLines, next } = collectLines(start, []);
  return { node: paragraph(paraLines.join("\n")), next };
};

type LineConsumer = (lines: readonly string[], i: number) => ConsumeResult | null;

const tryHeading: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.flatMapNullishOr((line) => parseHeadingLevel(line)),
    Option.map((h) => ({ node: heading(h.level, h.text), next: i + 1 })),
    Option.getOrNull,
  );

const tryMeta: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => line.trim() === "@document.meta"),
    Option.map(() => consumeMeta(lines, i)),
    Option.getOrNull,
  );

const tryCodeBlock: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => line.trimStart().startsWith("@code")),
    Option.map(() => consumeCodeBlock(lines, i)),
    Option.getOrNull,
  );

const tryVerbatimTag: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.map((line) => line.trimStart()),
    Option.filter(
      (trimmed) =>
        trimmed.startsWith("@") &&
        trimmed !== "@document.meta" &&
        !trimmed.startsWith("@code") &&
        trimmed !== "@end",
    ),
    Option.map(() => consumeVerbatimTag(lines, i)),
    Option.getOrNull,
  );

const tryStandardTag: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.map((line) => line.trimStart()),
    Option.filter(
      (trimmed) =>
        trimmed.startsWith("|") &&
        trimmed !== "|end" &&
        trimmed !== "|" &&
        !trimmed.startsWith("| "),
    ),
    Option.map(() => consumeStandardTag(lines, i)),
    Option.getOrNull,
  );

const tryHorizontalRule: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => /^-{3,}$/.test(line.trim())),
    Option.map(() => ({ node: horizontalRule(), next: i + 1 })),
    Option.getOrNull,
  );

const tryUnorderedList: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => line.trimStart().startsWith("- ")),
    Option.map(() => consumeUnorderedList(lines, i)),
    Option.getOrNull,
  );

const tryOrderedList: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => line.trimStart().startsWith("~ ")),
    Option.map(() => consumeOrderedList(lines, i)),
    Option.getOrNull,
  );

const tryQuote: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => line.trimStart().startsWith("> ")),
    Option.map(() => consumeQuote(lines, i)),
    Option.getOrNull,
  );

const tryDefinition: LineConsumer = (lines, i) =>
  Arr.get(lines, i).pipe(
    Option.filter((line) => line.trimStart().startsWith("$ ")),
    Option.map(() => consumeDefinition(lines, i)),
    Option.getOrNull,
  );

const consumers: readonly LineConsumer[] = [
  tryMeta,
  tryCodeBlock,
  tryVerbatimTag,
  tryStandardTag,
  tryHeading,
  tryHorizontalRule,
  tryUnorderedList,
  tryOrderedList,
  tryQuote,
  tryDefinition,
];

const dispatch = (lines: readonly string[], i: number): ConsumeResult =>
  Option.getOrElse(
    Arr.findFirst(
      Arr.map(consumers, (consumer) => consumer(lines, i)),
      (r): r is NonNullable<ConsumeResult> => r !== null,
    ),
    () => consumeParagraph(lines, i),
  );

export const parseToAst = (input: string): NorgDocument => {
  const lines = input.split("\n");

  const accumulate = (
    i: number,
    nodes: readonly NorgNode[],
    docMeta: NorgNode | undefined,
  ): { nodes: readonly NorgNode[]; meta: NorgNode | undefined } =>
    Arr.get(lines, i).pipe(
      Option.match({
        onNone: () => ({ nodes, meta: docMeta }),
        onSome: (line) => {
          if (line.trim() === "") return accumulate(i + 1, nodes, docMeta);
          const result = dispatch(lines, i);
          const nextMeta =
            result.node.type === "NorgMeta" && docMeta === undefined ? result.node : docMeta;
          const nextNodes =
            result.node.type === "NorgMeta" && docMeta === undefined
              ? nodes
              : Arr.append(nodes, result.node);
          return accumulate(result.next, nextNodes, nextMeta);
        },
      }),
    );

  const { nodes, meta: docMeta } = accumulate(0, [], undefined);
  return norgDoc(nodes, docMeta);
};

export const parse = (input: string): NorgDocument => parseToAst(input);

const prettyPrintNode = (node: NorgNode): string =>
  Match.value(node).pipe(
    Match.when({ type: "NorgHeading" }, (n) => "*".repeat(n.level) + " " + n.text),
    Match.when({ type: "NorgParagraph" }, (n) => n.text),
    Match.when({ type: "NorgList" }, (n) =>
      n.items.map((item) => (n.ordered ? `~ ${item}` : `- ${item}`)).join("\n"),
    ),
    Match.when(
      { type: "NorgCodeBlock" },
      (n) => "@code " + n.language + "\n" + n.content + "\n@end",
    ),
    Match.when({ type: "NorgQuote" }, (n) =>
      n.content
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n"),
    ),
    Match.when({ type: "NorgDefinition" }, (n) => `$ ${n.term}\n${n.body}`),
    Match.when({ type: "NorgTag" }, (n) => {
      const prefix = n.verbatim ? "@" : "|";
      const suffix = n.verbatim ? "@end" : "|end";
      const params = n.parameters !== "" ? " " + n.parameters : "";
      return `${prefix}${n.name}${params}\n${n.content}\n${suffix}`;
    }),
    Match.when({ type: "NorgHorizontalRule" }, () => "---"),
    Match.when({ type: "NorgMeta" }, (n) => {
      const entries = n.entries.map((e) => `${e.key}: ${e.value}`).join("\n");
      return `@document.meta\n${entries}\n@end`;
    }),
    Match.exhaustive,
  );

export const prettyPrintDoc = (doc: NorgDocument): string => {
  const metaStr = doc.meta !== undefined ? prettyPrintNode(doc.meta) : undefined;
  const nodesStr = doc.nodes.map(prettyPrintNode).join("\n\n");
  return metaStr !== undefined ? metaStr + "\n\n" + nodesStr : nodesStr;
};

export const fromAst = prettyPrintDoc;
