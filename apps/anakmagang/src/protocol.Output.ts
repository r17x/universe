import { Array as Arr, Console, Context, Effect, Layer, pipe } from "effect";
import { type Emission, $match, emissionChannel } from "./protocol.Emission";
import * as Html from "./Html";
import * as Markdown from "./Markdown";

export type FormatFn = (emission: Emission) => string;

const wrapContent = (
  e: { readonly mediaType: string; readonly content: string },
  wrapper: (content: string, mediaType: string) => string,
): string =>
  e.mediaType === "text" || e.mediaType === "html" ? e.content : wrapper(e.content, e.mediaType);

export const text: FormatFn = $match({
  Line: (e) => e.text,
  Record: (e) =>
    pipe(
      e.fields,
      Arr.map(([, v]) => v),
      Arr.join(" | "),
    ),
  Table: (e) => {
    const allRows = [e.headers, ...e.rows];
    const colWidths = Arr.map(e.headers, (_, ci) =>
      allRows.reduce((max, row) => Math.max(max, (row[ci] ?? "").length), 0),
    );
    return pipe(
      allRows,
      Arr.map((row) =>
        pipe(
          row,
          Arr.map((cell, ci) => cell.padEnd(colWidths[ci] ?? 0)),
          Arr.join("  "),
        ),
      ),
      Arr.join("\n"),
    );
  },
  Document: (e) => e.content,
  Diagnostic: (e) => e.message,
});

export const json: FormatFn = $match({
  Line: (e) => e.text,
  Record: (e) => JSON.stringify(Object.fromEntries(e.fields)),
  Table: (e) =>
    JSON.stringify(Arr.map(e.rows, (row) => Object.fromEntries(Arr.zip(e.headers, row)))),
  Document: (e) => e.content,
  Diagnostic: (e) => JSON.stringify({ severity: e.severity, message: e.message }),
});

export const markdown: FormatFn = $match({
  Line: (e) => e.text,
  Record: (e) =>
    pipe(
      e.fields,
      Arr.map(([k, v]) => `- **${k}**: ${v}`),
      Arr.join("\n"),
    ),
  Table: (e) => {
    if (Arr.length(e.headers) === 0 && Arr.length(e.rows) === 0) return "";
    const node = Markdown.table(e.headers, e.rows);
    return Markdown.prettyPrintMdDoc(Markdown.mdDoc(node));
  },
  Document: (e) => wrapContent(e, (content, mediaType) => `\`\`\`${mediaType}\n${content}\n\`\`\``),
  Diagnostic: (e) => `> **${e.severity}**: ${e.message}`,
});

export const html: FormatFn = $match({
  Line: (e) => Html.prettyPrintNode(Html.p(e.text)),
  Record: (e) =>
    Html.prettyPrintNode(
      Html.element(
        "dl",
        [],
        ...Arr.flatMap(e.fields, ([k, v]) => [
          Html.element("dt", [], Html.text(k)),
          Html.element("dd", [], Html.text(v)),
        ]),
      ),
    ),
  Table: (e) => Html.prettyPrintNode(Html.table(e.headers, e.rows)),
  Document: (e) =>
    e.mediaType === "html"
      ? e.content
      : Html.prettyPrintNode(
          Html.element("pre", [], Html.element("code", [], Html.text(e.content))),
        ),
  Diagnostic: (e) =>
    Html.prettyPrintNode(
      Html.div(
        [{ key: "class", value: e.severity }],
        Html.element("strong", [], Html.text(e.severity)),
        Html.text(`: ${e.message}`),
      ),
    ),
});

export const norg: FormatFn = $match({
  Line: (e) => e.text,
  Record: (e) =>
    pipe(
      e.fields,
      Arr.map(([k, v]) => `$ ${k}\n${v}`),
      Arr.join("\n\n"),
    ),
  Table: (e) => {
    if (Arr.length(e.headers) === 0 && Arr.length(e.rows) === 0) return "";
    const headerCells = pipe(
      e.headers,
      Arr.map((h, i) => `: ${i === 0 ? "." : ">"} : ${h}`),
    );
    const rowCells = pipe(
      e.rows,
      Arr.flatMap((row) =>
        pipe(
          row,
          Arr.map((cell, ci) => `: ${ci === 0 ? "_" : ">"} : ${cell}`),
        ),
      ),
    );
    return pipe(Arr.appendAll(headerCells, rowCells), Arr.join("\n"));
  },
  Document: (e) => wrapContent(e, (content, mediaType) => `@code ${mediaType}\n${content}\n@end`),
  Diagnostic: (e) => `> *${e.severity}*: ${e.message}`,
});

export const toml: FormatFn = $match({
  Line: (e) => e.text,
  Record: (e) =>
    pipe(
      e.fields,
      Arr.map(([k, v]) => `${k} = "${v}"`),
      Arr.join("\n"),
    ),
  Table: (e) =>
    pipe(
      e.rows,
      Arr.map((row) =>
        pipe(
          Arr.zip(e.headers, row),
          Arr.map(([h, c]) => `${h} = "${c}"`),
          (lines) => Arr.prepend(lines, "[[items]]"),
          Arr.join("\n"),
        ),
      ),
      Arr.join("\n\n"),
    ),
  Document: (e) => wrapContent(e, (content, mediaType) => `# mediaType: ${mediaType}\n${content}`),
  Diagnostic: (e) => `# [${e.severity}]: ${e.message}`,
});

export const agent: FormatFn = $match({
  Line: (e) => e.text,
  Record: (e) =>
    pipe(
      e.fields,
      Arr.map(([k, v]) => `${k}: ${v}`),
      Arr.join("\n"),
    ),
  Table: (e) => {
    if (Arr.length(e.headers) === 0 && Arr.length(e.rows) === 0) return "";
    return pipe(
      e.rows,
      Arr.map((row) =>
        pipe(
          Arr.zip(e.headers, row),
          Arr.map(([h, c]) => `${h}: ${c}`),
          Arr.join("\n"),
        ),
      ),
      Arr.join("\n---\n"),
    );
  },
  Document: (e) => e.content,
  Diagnostic: (e) => `${e.severity}: ${e.message}`,
});

export const silent: FormatFn = () => "";

export const Format: Context.Reference<FormatFn> = Context.Reference("@anakmagang/Format", {
  defaultValue: () => agent,
});

export interface OutputContract {
  readonly emit: (emission: Emission) => Effect.Effect<void>;
}

export class Output extends Context.Service<Output, OutputContract>()("@anakmagang/Output") {
  static readonly layer = Layer.effect(
    Output,
    Effect.gen(function* () {
      const fmt = yield* Format;
      return Output.of({
        emit: (emission) =>
          Effect.gen(function* () {
            const formatted = fmt(emission);
            if (formatted === "") return;
            const channel = emissionChannel(emission);
            yield* channel.channel === "stderr" ? Console.error(formatted) : Console.log(formatted);
          }),
      });
    }),
  );

  static readonly withFormat = (fmt: FormatFn) =>
    Layer.provideMerge(Output.layer, Layer.succeed(Format, fmt));
}
