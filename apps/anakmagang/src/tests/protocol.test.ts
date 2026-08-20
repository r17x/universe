import { describe, test, expect } from "bun:test";
import { Effect, Option } from "effect";
import { sortByBucket } from "../protocol.LatencyBucket";
import type { GuardConfig } from "../protocol.GuardConfig";
import {
  parseAddress,
  formatAddress,
  sessionStream,
  GUARD_RESULTS,
} from "../protocol.StreamAddress";
import {
  Line,
  Record,
  Table,
  Document,
  Diagnostic,
  $is,
  $match,
  emissionChannel,
} from "../protocol.Emission";
import { Priority } from "../protocol.Transport";
import { text, json, markdown, silent, html, Output } from "../protocol.Output";

describe("sortByBucket", () => {
  test("sorts always-local before local-first before round-trip", () => {
    const guards: GuardConfig[] = [
      { type: "auto-nix-eval", event: "PostToolUse" },
      { type: "compaction-gate", event: "PreToolUse" },
      { type: "agent-first", event: "PreToolUse" },
    ];
    const sorted = sortByBucket(guards);
    expect(sorted[0].type).toBe("agent-first");
    expect(sorted[1].type).toBe("compaction-gate");
    expect(sorted[2].type).toBe("auto-nix-eval");
  });

  test("preserves relative order within same bucket", () => {
    const guards: GuardConfig[] = [
      { type: "agent-first", event: "PreToolUse" },
      { type: "output-location", event: "PreToolUse" },
    ];
    const sorted = sortByBucket(guards);
    expect(sorted[0].type).toBe("agent-first");
    expect(sorted[1].type).toBe("output-location");
  });

  test("unknown guard type sorts to round-trip", () => {
    const guards: GuardConfig[] = [
      { type: "unknown-guard", event: "PreToolUse" },
      { type: "agent-first", event: "PreToolUse" },
    ];
    const sorted = sortByBucket(guards);
    expect(sorted[0].type).toBe("agent-first");
    expect(sorted[1].type).toBe("unknown-guard");
  });
});

describe("StreamAddress", () => {
  test("parseAddress splits owner:name", () => {
    const addr = parseAddress("guard:results");
    expect(addr).toEqual(Option.some({ owner: "guard", name: "results" }));
  });

  test("parseAddress returns None for invalid input", () => {
    expect(parseAddress("nocolon")).toEqual(Option.none());
  });

  test("formatAddress roundtrips with parseAddress", () => {
    const addr = Option.getOrThrow(parseAddress("session:phases"));
    expect(formatAddress(addr)).toBe("session:phases");
  });

  test("sessionStream creates address", () => {
    const addr = sessionStream("01JA3K", "phases");
    expect(addr).toEqual({ owner: "01JA3K", name: "phases" });
  });

  test("standard constants are well-formed", () => {
    expect(GUARD_RESULTS.owner).toBe("guard");
    expect(GUARD_RESULTS.name).toBe("results");
  });
});

describe("Emission construction", () => {
  test("Line can be constructed", () => {
    const e = Line({ text: "x" });
    expect($is("Line")(e)).toBe(true);
    expect(e.text).toBe("x");
  });

  test("Record can be constructed", () => {
    const e = Record({ fields: [["k", "v"]] });
    expect($is("Record")(e)).toBe(true);
    expect(e.fields).toEqual([["k", "v"]]);
  });

  test("Table can be constructed", () => {
    const e = Table({ headers: ["A"], rows: [["1"]] });
    expect($is("Table")(e)).toBe(true);
  });

  test("Document can be constructed", () => {
    const e = Document({ content: "hello", mediaType: "text" });
    expect($is("Document")(e)).toBe(true);
  });

  test("Diagnostic can be constructed", () => {
    const e = Diagnostic({ severity: "warn", message: "oops" });
    expect($is("Diagnostic")(e)).toBe(true);
  });

  test("$is works for each variant", () => {
    expect($is("Line")(Line({ text: "x" }))).toBe(true);
    expect($is("Line")(Record({ fields: [] }))).toBe(false);
    expect($is("Record")(Record({ fields: [] }))).toBe(true);
    expect($is("Table")(Table({ headers: [], rows: [] }))).toBe(true);
    expect($is("Document")(Document({ content: "", mediaType: "json" }))).toBe(true);
    expect($is("Diagnostic")(Diagnostic({ severity: "info", message: "" }))).toBe(true);
  });

  test("$match is exhaustive", () => {
    const matcher = $match({
      Line: () => "line",
      Record: () => "record",
      Table: () => "table",
      Document: () => "document",
      Diagnostic: () => "diagnostic",
    });
    expect(matcher(Line({ text: "" }))).toBe("line");
    expect(matcher(Record({ fields: [] }))).toBe("record");
    expect(matcher(Table({ headers: [], rows: [] }))).toBe("table");
    expect(matcher(Document({ content: "", mediaType: "yaml" }))).toBe("document");
    expect(matcher(Diagnostic({ severity: "error", message: "" }))).toBe("diagnostic");
  });
});

describe("emissionChannel", () => {
  test("Diagnostic maps to stderr with Render priority", () => {
    const result = emissionChannel(Diagnostic({ severity: "info", message: "x" }));
    expect(result).toEqual({ channel: "stderr", priority: Priority.Render });
  });

  test("Line maps to stdout with Data priority", () => {
    const result = emissionChannel(Line({ text: "x" }));
    expect(result).toEqual({ channel: "stdout", priority: Priority.Data });
  });

  test("Record maps to stdout with Data priority", () => {
    const result = emissionChannel(Record({ fields: [] }));
    expect(result).toEqual({ channel: "stdout", priority: Priority.Data });
  });

  test("Table maps to stdout with Data priority", () => {
    const result = emissionChannel(Table({ headers: [], rows: [] }));
    expect(result).toEqual({ channel: "stdout", priority: Priority.Data });
  });

  test("Document maps to stdout with Data priority", () => {
    const result = emissionChannel(Document({ content: "", mediaType: "text" }));
    expect(result).toEqual({ channel: "stdout", priority: Priority.Data });
  });
});

describe("text format", () => {
  test("Line returns text", () => {
    expect(text(Line({ text: "hello" }))).toBe("hello");
  });

  test("Record joins values with pipe", () => {
    expect(
      text(
        Record({
          fields: [
            ["a", "1"],
            ["b", "2"],
          ],
        }),
      ),
    ).toBe("1 | 2");
  });

  test("Table pads columns", () => {
    const result = text(Table({ headers: ["Name", "Value"], rows: [["x", "y"]] }));
    expect(result).toContain("Name");
    expect(result).toContain("Value");
    expect(result).toContain("x");
    expect(result).toContain("y");
  });

  test("Document returns content", () => {
    expect(text(Document({ content: "body", mediaType: "text" }))).toBe("body");
  });

  test("Diagnostic returns message", () => {
    expect(text(Diagnostic({ severity: "warn", message: "caution" }))).toBe("caution");
  });
});

describe("json format", () => {
  test("produces valid JSON for Record, Table, Diagnostic and raw strings for Line, Document", () => {
    expect(() => JSON.parse(json(Record({ fields: [["k", "v"]] })))).not.toThrow();
    expect(() => JSON.parse(json(Table({ headers: ["H"], rows: [["R"]] })))).not.toThrow();
    expect(() => JSON.parse(json(Diagnostic({ severity: "info", message: "m" })))).not.toThrow();
    expect(json(Line({ text: "x" }))).toBe("x");
    expect(json(Document({ content: "c", mediaType: "yaml" }))).toBe("c");
  });

  test("json output does not contain _tag", () => {
    expect(json(Line({ text: "x" }))).toBe("x");
    expect(json(Record({ fields: [["k", "v"]] }))).not.toContain("_tag");
    expect(json(Table({ headers: ["H"], rows: [["R"]] }))).not.toContain("_tag");
    expect(json(Diagnostic({ severity: "info", message: "m" }))).not.toContain("_tag");
  });
});

describe("Output service", () => {
  test("Output.withFormat(text) creates a working layer", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const output = yield* Output;
        return typeof output.emit;
      }).pipe(Effect.provide(Output.withFormat(text))),
    );
    expect(result).toBe("function");
  });

  test("Output.withFormat(silent) produces no output", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const output = yield* Output;
        yield* output.emit(Line({ text: "should be silent" }));
      }).pipe(Effect.provide(Output.withFormat(silent))),
    );
    expect(result).toBeUndefined();
  });
});

describe("Format functions", () => {
  test("text formats Record as pipe-joined values", () => {
    const formatted = text(
      Record({
        fields: [
          ["a", "1"],
          ["b", "2"],
        ],
      }),
    );
    expect(formatted).toBe("1 | 2");
  });

  test("json produces raw string for Line", () => {
    expect(json(Line({ text: "hello" }))).toBe("hello");
  });

  test("markdown formats Record as bullet list", () => {
    const formatted = markdown(
      Record({
        fields: [
          ["session", "ABC"],
          ["status", "ACTIVE"],
        ],
      }),
    );
    expect(formatted).toBe("- **session**: ABC\n- **status**: ACTIVE");
  });

  test("markdown formats Table as markdown table", () => {
    const formatted = markdown(Table({ headers: ["A", "B"], rows: [["1", "2"]] }));
    expect(formatted).toContain("| A | B |");
    expect(formatted).toContain("| 1 | 2 |");
  });

  test("markdown formats Diagnostic as blockquote", () => {
    const formatted = markdown(Diagnostic({ severity: "error", message: "fail" }));
    expect(formatted).toBe("> **error**: fail");
  });

  test("silent returns empty string for all emissions", () => {
    expect(silent(Line({ text: "hello" }))).toBe("");
    expect(silent(Record({ fields: [["k", "v"]] }))).toBe("");
    expect(silent(Table({ headers: [], rows: [] }))).toBe("");
  });
});

describe("html format", () => {
  test("Line renders as p element", () => {
    expect(html(Line({ text: "hello" }))).toBe("<p>hello</p>");
  });

  test("Record renders as dl with dt/dd pairs", () => {
    const formatted = html(
      Record({
        fields: [
          ["name", "test"],
          ["status", "active"],
        ],
      }),
    );
    expect(formatted).toContain("<dl>");
    expect(formatted).toContain("<dt>name</dt>");
    expect(formatted).toContain("<dd>test</dd>");
    expect(formatted).toContain("<dt>status</dt>");
    expect(formatted).toContain("<dd>active</dd>");
    expect(formatted).toContain("</dl>");
  });

  test("Table renders as HTML table with thead and tbody", () => {
    const formatted = html(Table({ headers: ["A", "B"], rows: [["1", "2"]] }));
    expect(formatted).toContain("<table>");
    expect(formatted).toContain("<thead>");
    expect(formatted).toContain("<th>A</th>");
    expect(formatted).toContain("<th>B</th>");
    expect(formatted).toContain("<tbody>");
    expect(formatted).toContain("<td>1</td>");
    expect(formatted).toContain("<td>2</td>");
    expect(formatted).toContain("</table>");
  });

  test("Document with html mediaType returns content as-is", () => {
    expect(html(Document({ content: "<b>bold</b>", mediaType: "html" }))).toBe("<b>bold</b>");
  });

  test("Document with non-html mediaType wraps in pre/code", () => {
    const formatted = html(Document({ content: '{"key":"val"}', mediaType: "json" }));
    expect(formatted).toContain("<pre>");
    expect(formatted).toContain("<code>");
    expect(formatted).toContain("</code>");
    expect(formatted).toContain("</pre>");
  });

  test("Diagnostic renders with severity class", () => {
    const formatted = html(Diagnostic({ severity: "error", message: "fail" }));
    expect(formatted).toContain('class="error"');
    expect(formatted).toContain("<strong>error</strong>");
    expect(formatted).toContain("fail");
  });
});
