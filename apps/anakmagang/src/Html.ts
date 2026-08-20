import { Array as Arr, Match, Option, Schema as S } from "effect";

type _HtmlAttribute = { readonly key: string; readonly value: string };

type _HtmlNode =
  | {
      readonly type: "HtmlElement";
      readonly tag: string;
      readonly attributes: ReadonlyArray<_HtmlAttribute>;
      readonly children: ReadonlyArray<_HtmlNode>;
    }
  | { readonly type: "HtmlText"; readonly content: string }
  | { readonly type: "HtmlComment"; readonly text: string }
  | {
      readonly type: "HtmlVoidElement";
      readonly tag: string;
      readonly attributes: ReadonlyArray<_HtmlAttribute>;
    };

const HtmlAttributeSchema = S.Struct({ key: S.String, value: S.String });

const HtmlTextSchema = S.Struct({ type: S.Literal("HtmlText"), content: S.String });

const HtmlCommentSchema = S.Struct({ type: S.Literal("HtmlComment"), text: S.String });

const HtmlVoidElementSchema = S.Struct({
  type: S.Literal("HtmlVoidElement"),
  tag: S.String,
  attributes: S.Array(HtmlAttributeSchema),
});

const HtmlElementSchema = S.Struct({
  type: S.Literal("HtmlElement"),
  tag: S.String,
  attributes: S.Array(HtmlAttributeSchema),
  children: S.Array(S.suspend((): S.Schema<_HtmlNode> => HtmlNode)),
});

export const HtmlNode: S.Schema<_HtmlNode> = S.Union([
  HtmlElementSchema,
  HtmlTextSchema,
  HtmlCommentSchema,
  HtmlVoidElementSchema,
]);
export type HtmlNode = S.Schema.Type<typeof HtmlNode>;

const HtmlDocumentSchema = S.Struct({
  type: S.Literal("HtmlDocument"),
  doctype: S.optionalKey(S.String),
  root: HtmlNode,
});

export const HtmlDocument = HtmlDocumentSchema;
export type HtmlDocument = S.Schema.Type<typeof HtmlDocument>;

export const element = (
  tag: string,
  attributes: ReadonlyArray<_HtmlAttribute>,
  ...children: ReadonlyArray<HtmlNode>
): HtmlNode => ({
  type: "HtmlElement",
  tag,
  attributes,
  children,
});

export const text = (content: string): HtmlNode => ({
  type: "HtmlText",
  content,
});

export const comment = (txt: string): HtmlNode => ({
  type: "HtmlComment",
  text: txt,
});

export const voidElement = (tag: string, attributes: ReadonlyArray<_HtmlAttribute>): HtmlNode => ({
  type: "HtmlVoidElement",
  tag,
  attributes,
});

export const htmlDoc = (root: HtmlNode, doctype?: string): HtmlDocument => ({
  type: "HtmlDocument",
  root,
  ...(doctype !== undefined ? { doctype } : {}),
});

export const div = (
  attrs: ReadonlyArray<_HtmlAttribute>,
  ...children: ReadonlyArray<HtmlNode>
): HtmlNode => element("div", attrs, ...children);

export const span = (
  attrs: ReadonlyArray<_HtmlAttribute>,
  ...children: ReadonlyArray<HtmlNode>
): HtmlNode => element("span", attrs, ...children);

export const p = (content: string): HtmlNode => element("p", [], text(content));

export const h = (level: 1 | 2 | 3 | 4 | 5 | 6, content: string): HtmlNode =>
  element(`h${level}`, [], text(content));

export const a = (href: string, content: string): HtmlNode =>
  element("a", [{ key: "href", value: href }], text(content));

export const img = (src: string, alt: string): HtmlNode =>
  voidElement("img", [
    { key: "src", value: src },
    { key: "alt", value: alt },
  ]);

export const br = (): HtmlNode => voidElement("br", []);

export const hr = (): HtmlNode => voidElement("hr", []);

export const ul = (items: ReadonlyArray<string>): HtmlNode =>
  element("ul", [], ...Arr.map(items, (i) => element("li", [], text(i))));

export const ol = (items: ReadonlyArray<string>): HtmlNode =>
  element("ol", [], ...Arr.map(items, (i) => element("li", [], text(i))));

export const table = (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): HtmlNode =>
  element(
    "table",
    [],
    element(
      "thead",
      [],
      element("tr", [], ...Arr.map(headers, (hd) => element("th", [], text(hd)))),
    ),
    element(
      "tbody",
      [],
      ...Arr.map(rows, (row) =>
        element("tr", [], ...Arr.map(row, (cell) => element("td", [], text(cell)))),
      ),
    ),
  );

const INLINE_TAGS = new Set([
  "span",
  "a",
  "strong",
  "em",
  "code",
  "b",
  "i",
  "u",
  "small",
  "sub",
  "sup",
  "abbr",
]);

const VOID_TAGS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
  "area",
  "base",
  "col",
  "embed",
  "source",
  "track",
  "wbr",
]);

const isInlineTag = (tag: string) => INLINE_TAGS.has(tag);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const formatAttributes = (attrs: ReadonlyArray<_HtmlAttribute>) =>
  attrs.length === 0
    ? ""
    : " " +
      Arr.map(attrs, (attr) =>
        attr.value === "" ? attr.key : `${attr.key}="${escapeHtml(attr.value)}"`,
      ).join(" ");

export const prettyPrintNode = (node: HtmlNode, indent = 0): string => {
  const spaces = "  ".repeat(indent);

  return Match.value(node).pipe(
    Match.when({ type: "HtmlText" }, (n) => `${spaces}${escapeHtml(n.content)}`),
    Match.when({ type: "HtmlComment" }, (n) => `${spaces}<!-- ${n.text} -->`),
    Match.when(
      { type: "HtmlVoidElement" },
      (n) => `${spaces}<${n.tag}${formatAttributes(n.attributes)}>`,
    ),
    Match.when({ type: "HtmlElement" }, (n) => {
      const open = `<${n.tag}${formatAttributes(n.attributes)}>`;
      const close = `</${n.tag}>`;

      if (n.children.length === 0) return `${spaces}${open}${close}`;

      if (isInlineTag(n.tag)) {
        const inner = Arr.map(n.children, (child) => prettyPrintNode(child, 0)).join("");
        return `${spaces}${open}${inner}${close}`;
      }

      const singleText = Arr.head(n.children).pipe(
        Option.filter((child) => n.children.length === 1 && child.type === "HtmlText"),
      );
      if (Option.isSome(singleText)) {
        const inner = prettyPrintNode(singleText.value, 0);
        return `${spaces}${open}${inner}${close}`;
      }

      const childrenStr = Arr.map(n.children, (child) => prettyPrintNode(child, indent + 1)).join(
        "\n",
      );
      return `${spaces}${open}\n${childrenStr}\n${spaces}${close}`;
    }),
    Match.exhaustive,
  );
};

export const prettyPrintDoc = (doc: HtmlDocument) => {
  const doctypeStr = doc.doctype !== undefined ? `<!DOCTYPE ${doc.doctype}>\n` : "";
  return doctypeStr + prettyPrintNode(doc.root, 0);
};

export const fromAst = prettyPrintDoc;

interface ParserState {
  readonly input: string;
  readonly pos: number;
}

const mkState = (input: string, pos: number): ParserState => ({ input, pos });

const peek = (state: ParserState) =>
  state.pos < state.input.length ? state.input.charAt(state.pos) : "";

const isEof = (state: ParserState) => state.pos >= state.input.length;

const advance = (state: ParserState, n = 1) => mkState(state.input, state.pos + n);

const startsWith = (state: ParserState, str: string) => state.input.startsWith(str, state.pos);

const skipWhitespace = (state: ParserState): ParserState =>
  !isEof(state) && /\s/.test(peek(state)) ? skipWhitespace(advance(state)) : state;

const readUntil = (state: ParserState, stop: string): { text: string; state: ParserState } => {
  const idx = state.input.indexOf(stop, state.pos);
  if (idx === -1) {
    return { text: state.input.slice(state.pos), state: mkState(state.input, state.input.length) };
  }
  return {
    text: state.input.slice(state.pos, idx),
    state: mkState(state.input, idx + stop.length),
  };
};

const readWhile = (
  state: ParserState,
  pred: (ch: string) => boolean,
): { text: string; state: ParserState } => {
  const collect = (s: ParserState, acc: string): { text: string; state: ParserState } =>
    !isEof(s) && pred(peek(s)) ? collect(advance(s), acc + peek(s)) : { text: acc, state: s };
  return collect(state, "");
};

const unescapeHtml = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseComment = (state: ParserState): { node: HtmlNode; state: ParserState } => {
  const s = advance(state, 4);
  const { text: commentText, state: afterComment } = readUntil(s, "-->");
  return { node: comment(commentText.trim()), state: afterComment };
};

const parseDoctype = (state: ParserState): { doctype: string; state: ParserState } => {
  const s = advance(state, 10);
  const { text: doctypeText, state: afterDoctype } = readUntil(s, ">");
  return { doctype: doctypeText.trim(), state: afterDoctype };
};

const parseAttributeValue = (state: ParserState): { value: string; state: ParserState } => {
  const ch = peek(state);
  if (ch === '"' || ch === "'") {
    const quote = ch;
    const s = advance(state);
    const { text: val, state: afterVal } = readUntil(s, quote);
    return { value: unescapeHtml(val), state: afterVal };
  }
  const { text: val, state: afterVal } = readWhile(state, (c) => !/[\s>/]/.test(c));
  return { value: unescapeHtml(val), state: afterVal };
};

const parseAttributes = (
  state: ParserState,
): { attrs: ReadonlyArray<_HtmlAttribute>; state: ParserState } => {
  const collect = (
    s: ParserState,
    acc: ReadonlyArray<_HtmlAttribute>,
  ): { attrs: ReadonlyArray<_HtmlAttribute>; state: ParserState } => {
    const ws = skipWhitespace(s);
    if (isEof(ws) || peek(ws) === ">" || startsWith(ws, "/>")) {
      return { attrs: acc, state: ws };
    }
    const { text: key, state: afterKey } = readWhile(ws, (c) => !/[\s=>/"']/.test(c));
    if (key === "") return { attrs: acc, state: ws };
    const afterKeyWs = skipWhitespace(afterKey);
    if (peek(afterKeyWs) === "=") {
      const afterEq = skipWhitespace(advance(afterKeyWs));
      const { value, state: afterVal } = parseAttributeValue(afterEq);
      return collect(afterVal, Arr.append(acc, { key, value }));
    }
    return collect(afterKeyWs, Arr.append(acc, { key, value: "" }));
  };
  return collect(state, []);
};

const parseTag = (
  state: ParserState,
): {
  tag: string;
  attrs: ReadonlyArray<_HtmlAttribute>;
  selfClose: boolean;
  state: ParserState;
} => {
  const s = advance(state);
  const { text: tag, state: afterTag } = readWhile(s, (c) => !/[\s>/]/.test(c));
  const { attrs, state: afterAttrs } = parseAttributes(afterTag);
  const ws = skipWhitespace(afterAttrs);
  if (startsWith(ws, "/>")) {
    return { tag: tag.toLowerCase(), attrs, selfClose: true, state: advance(ws, 2) };
  }
  const afterClose = peek(ws) === ">" ? advance(ws) : ws;
  return { tag: tag.toLowerCase(), attrs, selfClose: false, state: afterClose };
};

const parseClosingTag = (state: ParserState): { tag: string; state: ParserState } => {
  const s = advance(state, 2);
  const { text: tag, state: afterTag } = readWhile(s, (c) => c !== ">");
  return { tag: tag.trim().toLowerCase(), state: advance(afterTag) };
};

const parseTextNode = (state: ParserState): { node: HtmlNode; state: ParserState } => {
  const { text: raw, state: afterText } = readWhile(state, (c) => c !== "<");
  return { node: text(unescapeHtml(raw)), state: afterText };
};

const parseChildren = (
  state: ParserState,
  parentTag: string,
): { children: ReadonlyArray<HtmlNode>; state: ParserState } => {
  const collect = (
    s: ParserState,
    acc: ReadonlyArray<HtmlNode>,
  ): { children: ReadonlyArray<HtmlNode>; state: ParserState } => {
    if (isEof(s)) return { children: acc, state: s };
    if (startsWith(s, `</${parentTag}`) || startsWith(s, `</${parentTag.toUpperCase()}`)) {
      return { children: acc, state: s };
    }
    if (startsWith(s, "</")) {
      const lower = s.input.slice(s.pos + 2).toLowerCase();
      if (lower.startsWith(parentTag)) {
        return { children: acc, state: s };
      }
    }
    const { node, state: afterNode } = parseNode(s);
    if (node.type === "HtmlText" && node.content.trim() === "") {
      return collect(afterNode, acc);
    }
    return collect(afterNode, Arr.append(acc, node));
  };
  return collect(state, []);
};

const parseNode = (state: ParserState): { node: HtmlNode; state: ParserState } => {
  if (startsWith(state, "<!--")) return parseComment(state);
  if (peek(state) === "<" && !startsWith(state, "</")) {
    const { tag, attrs, selfClose, state: afterTag } = parseTag(state);
    if (selfClose || VOID_TAGS.has(tag)) {
      return { node: voidElement(tag, attrs), state: afterTag };
    }
    const { children, state: afterChildren } = parseChildren(afterTag, tag);
    const afterClose = startsWith(afterChildren, "</")
      ? parseClosingTag(afterChildren).state
      : afterChildren;
    return { node: element(tag, attrs, ...children), state: afterClose };
  }
  return parseTextNode(state);
};

const parseNodes = (state: ParserState): { nodes: ReadonlyArray<HtmlNode>; state: ParserState } => {
  const collect = (
    s: ParserState,
    acc: ReadonlyArray<HtmlNode>,
  ): { nodes: ReadonlyArray<HtmlNode>; state: ParserState } => {
    const ws = skipWhitespace(s);
    if (isEof(ws)) return { nodes: acc, state: ws };
    const { node, state: afterNode } = parseNode(ws);
    if (node.type === "HtmlText" && node.content.trim() === "") {
      return collect(afterNode, acc);
    }
    return collect(afterNode, Arr.append(acc, node));
  };
  return collect(state, []);
};

export const parse = (input: string): HtmlDocument => {
  const trimmed = input.trim();
  if (trimmed === "") return htmlDoc(element("html", []));

  const initial = mkState(trimmed, 0);
  const ws = skipWhitespace(initial);

  const doctypeMatch = startsWith(ws, "<!DOCTYPE") || startsWith(ws, "<!doctype");
  const { doctype, state: afterDoctype } = doctypeMatch
    ? parseDoctype(ws)
    : { doctype: undefined, state: ws };

  const { nodes, state: _final } = parseNodes(afterDoctype);

  if (nodes.length === 0) return htmlDoc(element("html", []), doctype);
  if (nodes.length === 1)
    return Arr.head(nodes).pipe(
      Option.match({
        onNone: () => htmlDoc(element("html", []), doctype),
        onSome: (root) => htmlDoc(root, doctype),
      }),
    );
  return htmlDoc(element("html", [], ...nodes), doctype);
};

export const parseToAst = parse;
