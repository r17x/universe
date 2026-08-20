import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Array as Arr, Option } from "effect";
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { text, json, markdown, toml, silent } from "../protocol.Output";
import { Line, Record, Table, Document, Diagnostic, type Emission } from "../protocol.Emission";

const BIN_PATH = join(import.meta.dir, "..", "bin.ts");

const SANDBOX_ROOT = mkdtempSync(join(tmpdir(), "anakmagang-test-"));
mkdirSync(join(SANDBOX_ROOT, ".anakmagang"), { recursive: true });
cpSync(
  join(import.meta.dir, "..", "..", "..", "..", ".anakmagang", "config.yaml"),
  join(SANDBOX_ROOT, ".anakmagang", "config.yaml"),
);
mkdirSync(join(SANDBOX_ROOT, ".anakmagang", "out"), { recursive: true });
mkdirSync(join(SANDBOX_ROOT, ".claude", "memories"), { recursive: true });
mkdirSync(join(SANDBOX_ROOT, ".claude", "agents"), { recursive: true });
mkdirSync(join(SANDBOX_ROOT, ".claude", "skills"), { recursive: true });

writeFileSync(
  join(SANDBOX_ROOT, "ARCHITECTURE.md"),
  "# anakmagang test fixture\nPhase transitions are managed by the orchestrator.\n",
);
writeFileSync(
  join(SANDBOX_ROOT, ".claude", "memories", "test-fixture.md"),
  "---\nname: test-fixture\ndescription: phase tracking fixture for e2e\ntype: project\nupdated: 2026-01-01\n---\nanakmagang phase tracking test fixture\n",
);
writeFileSync(
  join(SANDBOX_ROOT, ".claude", "agents", "test-agent.md"),
  "# Test Agent\n\nA fixture agent for e2e format tests.\n\n## Role\nTest agent used by automated tests.\n",
);

afterAll(() => {
  rmSync(SANDBOX_ROOT, { recursive: true, force: true });
});

const runCli = async (
  args: ReadonlyArray<string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const proc = Bun.spawn(["bun", "run", BIN_PATH, ...args], {
    cwd: SANDBOX_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
};

const nonEmptyLines = (s: string): ReadonlyArray<string> =>
  Arr.filter(s.split("\n"), (l) => l.length > 0);

const FORMATS = [["text"], ["json"], ["markdown"], ["html"], ["toml"]] as const;

describe("Layer 1: Format Purity", () => {
  const lineEmission = Line({ text: "hello world" });
  const recordEmission = Record({
    fields: [
      ["name", "test"],
      ["status", "active"],
    ],
  });
  const tableEmission = Table({
    headers: ["A", "B"],
    rows: [
      ["1", "2"],
      ["3", "4"],
    ],
  });
  const docEmission = Document({ content: '{"key":"value"}', mediaType: "json" });
  const diagInfo = Diagnostic({ severity: "info", message: "info msg" });
  const diagWarn = Diagnostic({ severity: "warn", message: "warn msg" });
  const diagError = Diagnostic({ severity: "error", message: "error msg" });

  const allEmissions: ReadonlyArray<readonly [string, Emission]> = [
    ["Line", lineEmission],
    ["Record", recordEmission],
    ["Table", tableEmission],
    ["Document", docEmission],
    ["Diagnostic(info)", diagInfo],
    ["Diagnostic(warn)", diagWarn],
    ["Diagnostic(error)", diagError],
  ];

  describe("text format", () => {
    test("Line returns raw text", () => {
      expect(text(lineEmission)).toBe("hello world");
    });

    test("Record returns pipe-separated values", () => {
      expect(text(recordEmission)).toBe("test | active");
    });

    test("Table returns aligned columns", () => {
      const result = text(tableEmission);
      const lines = result.split("\n");
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain("A");
      expect(lines[0]).toContain("B");
      expect(lines[1]).toContain("1");
      expect(lines[2]).toContain("3");
    });

    test("Document returns raw content", () => {
      expect(text(docEmission)).toBe('{"key":"value"}');
    });

    test("Diagnostic info returns message", () => {
      expect(text(diagInfo)).toBe("info msg");
    });

    test("Diagnostic warn returns message", () => {
      expect(text(diagWarn)).toBe("warn msg");
    });

    test("Diagnostic error returns message", () => {
      expect(text(diagError)).toBe("error msg");
    });
  });

  describe("json format", () => {
    test("Line returns raw text", () => {
      expect(json(lineEmission)).toBe("hello world");
    });

    test("Record encodes as JSON object from fields", () => {
      const parsed = JSON.parse(json(recordEmission));
      expect(parsed).toEqual({ name: "test", status: "active" });
    });

    test("Table encodes as JSON array of row objects", () => {
      const parsed = JSON.parse(json(tableEmission));
      expect(parsed).toEqual([
        { A: "1", B: "2" },
        { A: "3", B: "4" },
      ]);
    });

    test("Document returns raw content", () => {
      expect(json(docEmission)).toBe('{"key":"value"}');
    });

    test("Diagnostic info encodes without _tag", () => {
      const parsed = JSON.parse(json(diagInfo));
      expect(parsed).toEqual({ severity: "info", message: "info msg" });
    });

    test("Diagnostic warn encodes without _tag", () => {
      const parsed = JSON.parse(json(diagWarn));
      expect(parsed).toEqual({ severity: "warn", message: "warn msg" });
    });

    test("Diagnostic error encodes without _tag", () => {
      const parsed = JSON.parse(json(diagError));
      expect(parsed).toEqual({ severity: "error", message: "error msg" });
    });

    test("all emissions produce valid output (no _tag leak)", () => {
      for (const [, emission] of allEmissions) {
        const output = json(emission);
        expect(output).not.toContain('"_tag"');
      }
    });
  });

  describe("markdown format", () => {
    test("Line returns raw text", () => {
      expect(markdown(lineEmission)).toBe("hello world");
    });

    test("Record returns bullet list with bold keys", () => {
      const result = markdown(recordEmission);
      expect(result).toBe("- **name**: test\n- **status**: active");
    });

    test("Table returns markdown table with separator", () => {
      const result = markdown(tableEmission);
      expect(result).toContain("| A | B |");
      expect(result).toContain("|---|---|");
      expect(result).toContain("| 1 | 2 |");
      expect(result).toContain("| 3 | 4 |");
    });

    test("Document with json mediaType renders as fenced code block", () => {
      expect(markdown(docEmission)).toBe('```json\n{"key":"value"}\n```');
    });

    test("Document with yaml mediaType renders as fenced code block", () => {
      const yamlDoc = Document({ content: "key: value\nlist:\n  - item", mediaType: "yaml" });
      expect(markdown(yamlDoc)).toBe("```yaml\nkey: value\nlist:\n  - item\n```");
    });

    test("Document with text mediaType renders as plain text", () => {
      const textDoc = Document({ content: "plain text content", mediaType: "text" });
      expect(markdown(textDoc)).toBe("plain text content");
    });

    test("Diagnostic info renders as blockquote", () => {
      expect(markdown(diagInfo)).toBe("> **info**: info msg");
    });

    test("Diagnostic warn renders as blockquote", () => {
      expect(markdown(diagWarn)).toBe("> **warn**: warn msg");
    });

    test("Diagnostic error renders as blockquote", () => {
      expect(markdown(diagError)).toBe("> **error**: error msg");
    });
  });

  describe("toml format", () => {
    test("Line returns raw text", () => {
      expect(toml(lineEmission)).toBe("hello world");
    });

    test("Record returns key = value pairs", () => {
      const result = toml(recordEmission);
      expect(result).toBe('name = "test"\nstatus = "active"');
    });

    test("Table returns array of tables", () => {
      const result = toml(tableEmission);
      expect(result).toContain("[[items]]");
      expect(result).toContain('A = "1"');
      expect(result).toContain('B = "2"');
      expect(result).toContain('A = "3"');
      expect(result).toContain('B = "4"');
    });

    test("Document with json mediaType renders with comment header", () => {
      expect(toml(docEmission)).toBe('# mediaType: json\n{"key":"value"}');
    });

    test("Document with text mediaType renders as plain content", () => {
      const textDoc = Document({ content: "plain text", mediaType: "text" });
      expect(toml(textDoc)).toBe("plain text");
    });

    test("Document with html mediaType renders as plain content", () => {
      const htmlDoc = Document({ content: "<p>hi</p>", mediaType: "html" });
      expect(toml(htmlDoc)).toBe("<p>hi</p>");
    });

    test("Diagnostic info renders as TOML comment", () => {
      expect(toml(diagInfo)).toBe("# [info]: info msg");
    });

    test("Diagnostic warn renders as TOML comment", () => {
      expect(toml(diagWarn)).toBe("# [warn]: warn msg");
    });

    test("Diagnostic error renders as TOML comment", () => {
      expect(toml(diagError)).toBe("# [error]: error msg");
    });
  });

  describe("silent format", () => {
    test("all emissions produce empty string", () => {
      for (const [, emission] of allEmissions) {
        expect(silent(emission)).toBe("");
      }
    });
  });

  describe("json roundtrip preserves structure", () => {
    test("Record roundtrips through json encode/parse", () => {
      const original = Record({
        fields: [
          ["x", "y"],
          ["a", "b"],
        ],
      });
      const parsed = JSON.parse(json(original));
      expect(parsed).toEqual({ x: "y", a: "b" });
    });

    test("Table roundtrips through json encode/parse", () => {
      const original = Table({ headers: ["H1", "H2"], rows: [["r1c1", "r1c2"]] });
      const parsed = JSON.parse(json(original));
      expect(parsed).toEqual([{ H1: "r1c1", H2: "r1c2" }]);
    });

    test("Diagnostic roundtrips through json encode/parse", () => {
      const original = Diagnostic({ severity: "error", message: "something broke" });
      const parsed = JSON.parse(json(original));
      expect(parsed).toEqual({ severity: "error", message: "something broke" });
    });
  });
});

describe("Layer 2: Edge Cases & Boundary Conditions", () => {
  describe("empty inputs", () => {
    const emptyLine = Line({ text: "" });
    const emptyRecord = Record({ fields: [] });
    const emptyTable = Table({ headers: [], rows: [] });
    const emptyDocument = Document({ content: "", mediaType: "json" });
    const emptyDiagnostic = Diagnostic({ severity: "info", message: "" });

    test("Line with empty text — text format returns empty string", () => {
      expect(text(emptyLine)).toBe("");
    });

    test("Line with empty text — json format returns empty string", () => {
      expect(json(emptyLine)).toBe("");
    });

    test("Line with empty text — markdown format returns empty string", () => {
      expect(markdown(emptyLine)).toBe("");
    });

    test("Record with empty fields — text format returns empty string", () => {
      expect(text(emptyRecord)).toBe("");
    });

    test("Record with empty fields — json format returns empty object", () => {
      expect(JSON.parse(json(emptyRecord))).toEqual({});
    });

    test("Record with empty fields — markdown format returns empty string", () => {
      expect(markdown(emptyRecord)).toBe("");
    });

    test("Table with no headers or rows — text format handles gracefully", () => {
      const result = text(emptyTable);
      expect(result).toBe("");
    });

    test("Table with no headers or rows — json format returns empty array", () => {
      expect(JSON.parse(json(emptyTable))).toEqual([]);
    });

    test("Table with no headers or rows — markdown format handles gracefully", () => {
      const result = markdown(emptyTable);
      expect(result).toBe("");
    });

    test("Document with empty content — markdown format produces valid fence markers", () => {
      expect(markdown(emptyDocument)).toBe("```json\n\n```");
    });

    test("Document with empty content — text format returns empty string", () => {
      expect(text(emptyDocument)).toBe("");
    });

    test("Document with empty content — json format returns empty string", () => {
      expect(json(emptyDocument)).toBe("");
    });

    test("Diagnostic with empty message — text format returns empty string", () => {
      expect(text(emptyDiagnostic)).toBe("");
    });

    test("Diagnostic with empty message — markdown format returns blockquote", () => {
      expect(markdown(emptyDiagnostic)).toBe("> **info**: ");
    });

    test("Diagnostic with empty message — json format returns valid JSON", () => {
      expect(JSON.parse(json(emptyDiagnostic))).toEqual({ severity: "info", message: "" });
    });
  });

  describe("special characters that break formatting", () => {
    test("Record value containing pipe — text format remains parseable", () => {
      const emission = Record({ fields: [["key", "val | with pipe"]] });
      const result = text(emission);
      expect(result).toContain("val | with pipe");
    });

    test("Record key containing markdown bold — markdown format handles ambiguity", () => {
      const emission = Record({ fields: [["**bold**", "value"]] });
      const result = markdown(emission);
      expect(result).toContain("**bold**");
      expect(result).toContain("value");
    });

    test("Document content containing triple backticks — markdown fenced block", () => {
      const emission = Document({ content: "```\nfake fence\n```", mediaType: "json" });
      const result = markdown(emission);
      expect(result).toBe("```json\n```\nfake fence\n```\n```");
    });

    test("Line text that looks like JSON — text format passes through as plain text", () => {
      const emission = Line({ text: '{"_tag":"Line","text":"nested"}' });
      expect(text(emission)).toBe('{"_tag":"Line","text":"nested"}');
    });

    test("Line text that looks like JSON — json format passes through as plain text", () => {
      const emission = Line({ text: '{"_tag":"Line","text":"nested"}' });
      expect(json(emission)).toBe('{"_tag":"Line","text":"nested"}');
    });
  });

  describe("multi-line content", () => {
    test("Line with multi-line text — text format preserves newlines", () => {
      const emission = Line({ text: "line1\nline2\nline3" });
      expect(text(emission)).toBe("line1\nline2\nline3");
    });

    test("Line with multi-line text — json format returns raw text", () => {
      const emission = Line({ text: "line1\nline2\nline3" });
      expect(json(emission)).toBe("line1\nline2\nline3");
    });

    test("Diagnostic with multi-line message — markdown blockquote handles each line", () => {
      const emission = Diagnostic({ severity: "warn", message: "line1\nline2" });
      const result = markdown(emission);
      expect(result).toContain("> **warn**");
      expect(result).toContain("line1");
      expect(result).toContain("line2");
    });
  });

  describe("table edge cases", () => {
    test("single column table — text format renders correctly", () => {
      const emission = Table({ headers: ["ONLY"], rows: [["a"], ["b"]] });
      const result = text(emission);
      const lines = result.split("\n");
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain("ONLY");
      expect(lines[1]).toContain("a");
      expect(lines[2]).toContain("b");
    });

    test("single column table — markdown format renders correctly", () => {
      const emission = Table({ headers: ["ONLY"], rows: [["a"], ["b"]] });
      const result = markdown(emission);
      expect(result).toContain("| ONLY |");
      expect(result).toContain("|---|");
      expect(result).toContain("| a |");
      expect(result).toContain("| b |");
    });

    test("wide cells — text format aligns columns", () => {
      const emission = Table({ headers: ["short", "very long header name"], rows: [["x", "y"]] });
      const result = text(emission);
      const lines = result.split("\n");
      expect(lines[0]).toContain("short");
      expect(lines[0]).toContain("very long header name");
    });

    test("empty cells — text format handles gracefully", () => {
      const emission = Table({
        headers: ["A", "B"],
        rows: [
          ["", "filled"],
          ["data", ""],
        ],
      });
      const result = text(emission);
      expect(result).toContain("filled");
      expect(result).toContain("data");
    });

    test("empty cells — json format preserves empty strings", () => {
      const emission = Table({
        headers: ["A", "B"],
        rows: [
          ["", "filled"],
          ["data", ""],
        ],
      });
      const parsed = JSON.parse(json(emission));
      expect(parsed).toEqual([
        { A: "", B: "filled" },
        { A: "data", B: "" },
      ]);
    });
  });

  describe("json roundtrip completeness", () => {
    test("Line roundtrips through json as raw text", () => {
      const original = Line({ text: "roundtrip test" });
      expect(json(original)).toBe("roundtrip test");
    });

    test("Document roundtrips through json as raw content", () => {
      const original = Document({ content: "some content", mediaType: "yaml" });
      expect(json(original)).toBe("some content");
    });
  });

  describe("format orthogonality", () => {
    test("silent always returns empty string regardless of emission complexity", () => {
      const largeTable = Table({
        headers: ["Col1", "Col2", "Col3", "Col4", "Col5"],
        rows: [
          ["a1", "a2", "a3", "a4", "a5"],
          ["b1", "b2", "b3", "b4", "b5"],
          ["c1", "c2", "c3", "c4", "c5"],
          ["d1", "d2", "d3", "d4", "d5"],
          ["e1", "e2", "e3", "e4", "e5"],
        ],
      });
      expect(silent(largeTable)).toBe("");
    });

    test("json output of Line preserves multi-line text", () => {
      const emission = Line({ text: "multi\nline\ncontent" });
      const result = json(emission);
      expect(result).toBe("multi\nline\ncontent");
    });

    test("json output of Record is always a single line", () => {
      const emission = Record({
        fields: [
          ["k1", "v1"],
          ["k2", "v2\nwith newline"],
        ],
      });
      const result = json(emission);
      expect(result.split("\n").length).toBe(1);
    });

    test("json output of Table is always a single line", () => {
      const emission = Table({
        headers: ["A", "B"],
        rows: [
          ["1", "2"],
          ["3", "4"],
        ],
      });
      const result = json(emission);
      expect(result.split("\n").length).toBe(1);
    });

    test("json output of Document preserves multi-line content", () => {
      const emission = Document({ content: "line1\nline2", mediaType: "text" });
      const result = json(emission);
      expect(result).toBe("line1\nline2");
    });

    test("json output of Diagnostic is always a single line", () => {
      const emission = Diagnostic({ severity: "error", message: "multi\nline\nerror" });
      const result = json(emission);
      expect(result.split("\n").length).toBe(1);
    });
  });
});

describe("Layer 3: CLI Wiring", () => {
  let KNOWN_SESSION = "";

  beforeAll(async () => {
    const result = await runCli(["start", "test fixture"]);
    const match = result.stdout.match(/session:\s*(\S+)/);
    if (!match)
      throw new Error(`Failed to create fixture session: ${result.stdout} ${result.stderr}`);
    KNOWN_SESSION = match[1];
  });

  afterAll(async () => {
    if (KNOWN_SESSION) await runCli(["drop", KNOWN_SESSION]);
  });

  describe("state (Record output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Record output",
      async (format) => {
        const result = await runCli(["state", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          for (const line of lines) {
            const parsed = JSON.parse(line);
            expect(parsed).toHaveProperty("session");
            expect(parsed).toHaveProperty("status");
          }
        } else if (format === "text") {
          for (const line of lines) {
            expect(line).toContain(" | ");
            expect(line).not.toContain('"_tag"');
          }
        } else if (format === "markdown") {
          expect(result.stdout).toContain("- **session**:");
          expect(result.stdout).toContain("- **status**:");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (format === "toml") {
          expect(result.stdout).toContain('session = "');
          expect(result.stdout).toContain('status = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dt>session</dt>");
          expect(result.stdout).toContain("<dt>status</dt>");
          expect(result.stdout).not.toContain('"_tag"');
        }
      },
      15000,
    );
  });

  describe("config guard list (Table output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Table output",
      async (format) => {
        const result = await runCli(["config", "guard", "list", "-f", format]);
        expect(result.exitCode).toBe(0);
        if (format === "json") {
          const lines = nonEmptyLines(result.stdout);
          expect(lines.length).toBe(1);
          const parsed = JSON.parse(lines[0]);
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed[0]).toHaveProperty("TYPE");
          expect(parsed[0]).toHaveProperty("ENFORCED_BY");
        } else if (format === "text") {
          expect(result.stdout).toContain("TYPE");
          expect(result.stdout).toContain("ENFORCED_BY");
          expect(result.stdout).not.toContain("|---|");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (format === "markdown") {
          expect(result.stdout).toContain("| TYPE |");
          expect(result.stdout).toContain("|---|");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (format === "toml") {
          expect(result.stdout).toContain("[[items]]");
          expect(result.stdout).toContain('TYPE = "');
          expect(result.stdout).toContain('ENFORCED_BY = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<table>");
          expect(result.stdout).toContain("<th>TYPE</th>");
          expect(result.stdout).toContain("<th>ENFORCED_BY</th>");
          expect(result.stdout).not.toContain('"_tag"');
        }
      },
      15000,
    );
  });

  describe("config summary (Line + Table mix)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct mixed output",
      async (format) => {
        const result = await runCli(["config", "summary", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          const hasPlainText = Arr.some(lines, (l) => {
            try {
              JSON.parse(l);
              return false;
            } catch {
              return true;
            }
          });
          const hasJsonArray = Arr.some(lines, (l) => {
            try {
              return Array.isArray(JSON.parse(l));
            } catch {
              return false;
            }
          });
          expect(hasPlainText).toBe(true);
          expect(hasJsonArray).toBe(true);
        } else if (format === "text") {
          expect(result.stdout).not.toContain("|---|");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (format === "markdown") {
          expect(result.stdout).toContain("|---|");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (format === "toml") {
          expect(result.stdout).toContain("[[items]]");
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<table>");
          expect(result.stdout).not.toContain('"_tag"');
        }
      },
      15000,
    );
  });

  describe("memory status (Line output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Line output",
      async (format) => {
        const result = await runCli(["memory", "status", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          expect(lines[0]).toMatch(/^Total:/);
        } else if (format === "text") {
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).not.toContain('"_tag"');
        }
      },
      15000,
    );
  });

  describe("hook list (Line output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Line output",
      async (format) => {
        const result = await runCli(["hook", "list", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          for (const line of lines) {
            expect(line).not.toContain('"_tag"');
          }
        } else if (format === "text") {
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).not.toContain('"_tag"');
        }
      },
      15000,
    );
  });

  describe("error paths", () => {
    test.each(FORMATS)(
      "-f %s config get nonexistent.key emits Diagnostic error",
      async (format) => {
        const result = await runCli(["config", "get", "nonexistent.key", "-f", format]);
        if (format === "json") {
          const stderrLines = nonEmptyLines(result.stderr);
          const parsed = JSON.parse(stderrLines[0]);
          expect(parsed.severity).toBe("error");
          expect(parsed.message).toContain("Key not found: nonexistent.key");
        } else if (format === "text") {
          expect(result.stderr).toContain("Key not found: nonexistent.key");
          expect(result.stderr).not.toContain('"_tag"');
        } else if (format === "markdown") {
          expect(result.stderr).toContain("> **error**:");
          expect(result.stderr).toContain("Key not found: nonexistent.key");
          expect(result.stderr).not.toContain('"_tag"');
        } else if (format === "toml") {
          expect(result.stderr).toContain("# [error]:");
          expect(result.stderr).toContain("Key not found: nonexistent.key");
          expect(result.stderr).not.toContain('"_tag"');
        } else {
          expect(result.stderr).toContain("<strong>error</strong>");
          expect(result.stderr).toContain("Key not found: nonexistent.key");
          expect(result.stderr).not.toContain('"_tag"');
        }
      },
      15000,
    );

    test("drop NONEXISTENT_SESSION produces error", async () => {
      const result = await runCli(["drop", "NONEXISTENT_SESSION", "-f", "text"]);
      const hasError = result.exitCode !== 0 || result.stderr.length > 0;
      expect(hasError).toBe(true);
    }, 15000);

    test("-f with invalid format rejects with Diagnostic error", async () => {
      const result = await runCli(["state", "-f", "abcd"]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("abcd");
    }, 15000);

    test("without -f defaults to agent format", async () => {
      const result = await runCli(["state"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('"_tag"');
      expect(result.stdout).toContain(": ");
    }, 15000);

    test("-f text returns text format", async () => {
      const result = await runCli(["state", "-f", "text"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('"_tag"');
      expect(result.stdout).toContain(" | ");
    }, 15000);
  });

  test("state -f silent returns empty stdout", async () => {
    const result = await runCli(["state", "-f", "silent"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  }, 15000);

  test("--help works regardless of format", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
  }, 15000);

  describe("config get scalar (Line output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Line output",
      async (format) => {
        const result = await runCli(["config", "get", "name", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          expect(result.stdout.trim()).toBe("orchestrate");
        } else if (format === "text") {
          expect(result.stdout).toContain("orchestrate");
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("orchestrate");
          expect(result.stdout).not.toContain('"_tag"');
        }
      },
      15000,
    );
  });

  describe("config get complex value (Table output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Table output",
      async (format) => {
        const result = await runCli(["config", "get", "phases", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          expect(lines.length).toBe(1);
          const parsed = JSON.parse(lines[0]);
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed.length).toBeGreaterThan(0);
          expect(parsed[0]).toHaveProperty("id");
          expect(parsed[0]).toHaveProperty("name");
        } else if (format === "text") {
          expect(result.stdout).toContain("setup");
        } else {
          expect(result.stdout).toContain("setup");
        }
      },
      15000,
    );
  });

  describe("config get phases (Table rendering)", () => {
    const EXPECTED_PHASE_IDS = [
      "setup",
      "triage",
      "discovery",
      "skill_discovery",
      "complexity",
      "brainstorming",
      "architecture",
      "implementation",
      "design_verification",
      "domain_compliance",
      "code_quality",
      "test_planning",
      "testing",
      "coverage",
      "test_quality",
      "completion",
    ] as const;

    const EXPECTED_NEXT_CHAIN: ReadonlyArray<readonly [string, string]> = [
      ["setup", "triage"],
      ["triage", "discovery"],
      ["discovery", "skill_discovery"],
      ["skill_discovery", "complexity"],
      ["complexity", "brainstorming"],
      ["brainstorming", "architecture"],
      ["architecture", "implementation"],
      ["implementation", "design_verification"],
      ["design_verification", "domain_compliance"],
      ["domain_compliance", "code_quality"],
      ["code_quality", "test_planning"],
      ["test_planning", "testing"],
      ["testing", "coverage"],
      ["coverage", "test_quality"],
      ["test_quality", "completion"],
    ];

    test("-f json contains all 16 phases with correct schema", async () => {
      const result = await runCli(["config", "get", "phases", "-f", "json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim());
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(16);

      for (const row of parsed) {
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("name");
        expect(row).toHaveProperty("exit_question");
        expect(row).toHaveProperty("next");
        expect(row).toHaveProperty("actions");
      }

      const ids = Arr.map(parsed as Array<{ id: string }>, (r) => r.id);
      expect(ids).toEqual([...EXPECTED_PHASE_IDS]);

      expect(parsed[0].id).toBe("setup");
      expect(parsed[15].id).toBe("completion");
    }, 15000);

    test("-f json next-pointer chain is correct", async () => {
      const result = await runCli(["config", "get", "phases", "-f", "json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim()) as ReadonlyArray<{
        id: string;
        next: string;
      }>;

      for (const [fromId, toId] of EXPECTED_NEXT_CHAIN) {
        const phase = Arr.findFirst(parsed, (r) => r.id === fromId);
        expect(Option.isSome(phase)).toBe(true);
        if (Option.isSome(phase)) {
          expect(phase.value.next).toBe(toId);
        }
      }

      const completion = Arr.findFirst(parsed, (r) => r.id === "completion");
      expect(Option.isSome(completion)).toBe(true);
      if (Option.isSome(completion)) {
        expect(completion.value.next).toBe("null");
      }
    }, 15000);

    test("-f json spot-check exit_questions", async () => {
      const result = await runCli(["config", "get", "phases", "-f", "json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim()) as ReadonlyArray<{
        id: string;
        exit_question: string;
      }>;

      const setup = Arr.findFirst(parsed, (r) => r.id === "setup");
      expect(Option.isSome(setup)).toBe(true);
      if (Option.isSome(setup)) {
        expect(setup.value.exit_question).toContain("What assumptions am I carrying?");
      }

      const implementation = Arr.findFirst(parsed, (r) => r.id === "implementation");
      expect(Option.isSome(implementation)).toBe(true);
      if (Option.isSome(implementation)) {
        expect(implementation.value.exit_question).toContain("Did I delegate with enough context?");
      }

      const completion = Arr.findFirst(parsed, (r) => r.id === "completion");
      expect(Option.isSome(completion)).toBe(true);
      if (Option.isSome(completion)) {
        expect(completion.value.exit_question).toContain(
          "What would I do differently if I started over?",
        );
      }
    }, 15000);

    test("-f text contains all phase ids and table headers", async () => {
      const result = await runCli(["config", "get", "phases", "-f", "text"]);
      expect(result.exitCode).toBe(0);

      for (const phaseId of EXPECTED_PHASE_IDS) {
        expect(result.stdout).toContain(phaseId);
      }

      expect(result.stdout).toContain("id");
      expect(result.stdout).toContain("name");
      expect(result.stdout).toContain("exit_question");
      expect(result.stdout).toContain("next");
      expect(result.stdout).toContain("actions");

      expect(result.stdout).not.toContain("|---|");
      expect(result.stdout).not.toContain('"_tag"');
    }, 15000);

    test("-f markdown contains table structure and all phase ids", async () => {
      const result = await runCli(["config", "get", "phases", "-f", "markdown"]);
      expect(result.exitCode).toBe(0);

      expect(result.stdout).toMatch(/\|\s*id\s*\|/);
      expect(result.stdout).toMatch(/\|\s*name\s*\|/);
      expect(result.stdout).toContain("|---|");

      for (const phaseId of EXPECTED_PHASE_IDS) {
        expect(result.stdout).toContain(phaseId);
      }

      expect(result.stdout).not.toContain('"_tag"');
    }, 15000);
  });

  describe("config list (Record output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct output",
      async (format) => {
        const result = await runCli(["config", "list", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          for (const line of lines) {
            const parsed = JSON.parse(line);
            expect(typeof parsed).toBe("object");
            expect(parsed).not.toHaveProperty("_tag");
          }
        } else if (format === "text") {
          expect(lines.length).toBeGreaterThan(0);
        } else if (format === "markdown") {
          expect(result.stdout).toContain("- **");
        } else if (format === "toml") {
          expect(result.stdout).toContain(' = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dl>");
        }
      },
      15000,
    );
  });

  describe("query (Record output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Record output",
      async (format) => {
        const result = await runCli(["query", "phase", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          for (const line of lines) {
            const parsed = JSON.parse(line);
            expect(typeof parsed).toBe("object");
            expect(parsed).not.toHaveProperty("_tag");
          }
        } else if (format === "text") {
          for (const line of lines) {
            expect(line).toContain(" | ");
          }
        } else if (format === "markdown") {
          expect(result.stdout).toContain("- **");
        } else if (format === "toml") {
          expect(result.stdout).toContain(' = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dl>");
        }
      },
      20000,
    );
  });

  describe("search grep (Record output)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct Record output",
      async (format) => {
        const result = await runCli(["search", "grep", "anakmagang", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          for (const line of lines) {
            const parsed = JSON.parse(line);
            expect(typeof parsed).toBe("object");
            expect(parsed).not.toHaveProperty("_tag");
          }
        } else if (format === "text") {
          for (const line of lines) {
            expect(line).toContain(" | ");
          }
        } else if (format === "markdown") {
          expect(result.stdout).toContain("- **");
        } else if (format === "toml") {
          expect(result.stdout).toContain(' = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dl>");
        }
      },
      20000,
    );
  });

  describe("audit agents (Line output — format bug)", () => {
    test.each(FORMATS)(
      "-f %s produces format-correct output",
      async (format) => {
        const result = await runCli(["audit", "agents", "-f", format]);
        expect(result.exitCode).toBe(0);
        const lines = nonEmptyLines(result.stdout);
        expect(lines.length).toBeGreaterThan(0);
        if (format === "json") {
          for (const line of lines) {
            expect(line).not.toContain('"_tag"');
          }
        } else if (format === "text") {
          for (const line of lines) {
            expect(line).not.toContain('"_tag"');
          }
        } else {
          expect(result.stdout).not.toContain('"_tag"');
          expect(result.stdout).not.toContain('{"text":');
        }
      },
      15000,
    );
  });
});

describe("Layer 4: Mutation Sequence", () => {
  for (const [formatFlag] of FORMATS) {
    describe(`lifecycle in ${formatFlag} format`, () => {
      let sessionId: string | undefined;

      afterAll(async () => {
        if (sessionId !== undefined) {
          await runCli(["drop", sessionId, "-f", "silent"]);
        }
      });

      test("start creates session (Record)", async () => {
        const result = await runCli(["start", `format-e2e-${formatFlag}`, "-f", formatFlag]);
        expect(result.exitCode).toBe(0);

        if (formatFlag === "json") {
          const lines = nonEmptyLines(result.stdout);
          const parsed = JSON.parse(lines[0]);
          expect(parsed).toHaveProperty("session");
          sessionId = parsed.session;
          expect(sessionId).toMatch(/^[A-Z0-9]{26}$/);
        } else if (formatFlag === "text") {
          expect(result.stdout).toContain(" | ");
          expect(result.stdout).not.toContain('"_tag"');
          const match = result.stdout.match(/[A-Z0-9]{26}/);
          expect(match).not.toBeNull();
          if (match !== null) {
            sessionId = match[0];
          }
        } else if (formatFlag === "markdown") {
          expect(result.stdout).toContain("- **session**:");
          expect(result.stdout).not.toContain('"_tag"');
          const match = result.stdout.match(/[A-Z0-9]{26}/);
          expect(match).not.toBeNull();
          if (match !== null) {
            sessionId = match[0];
          }
        } else if (formatFlag === "toml") {
          expect(result.stdout).toContain('session = "');
          expect(result.stdout).not.toContain('"_tag"');
          const match = result.stdout.match(/[A-Z0-9]{26}/);
          expect(match).not.toBeNull();
          if (match !== null) {
            sessionId = match[0];
          }
        } else {
          expect(result.stdout).toContain("<dt>session</dt>");
          expect(result.stdout).not.toContain('"_tag"');
          const match = result.stdout.match(/[A-Z0-9]{26}/);
          expect(match).not.toBeNull();
          if (match !== null) {
            sessionId = match[0];
          }
        }

        expect(sessionId).toBeDefined();
      }, 15000);

      test("observe records observation (Line)", async () => {
        if (sessionId === undefined) return;
        const result = await runCli([
          "eval",
          "test observation for e2e",
          "--observe",
          "--session",
          sessionId,
          "-f",
          formatFlag,
        ]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("observed");

        if (formatFlag === "json") {
          expect(result.stdout).toContain("observed");
        } else {
          expect(result.stdout).not.toContain('"_tag"');
        }
      }, 15000);

      test("update records note (Record)", async () => {
        if (sessionId === undefined) return;
        const result = await runCli([
          "update",
          "findings",
          "test-value",
          "--session",
          sessionId,
          "-f",
          formatFlag,
        ]);
        expect(result.exitCode).toBe(0);

        if (formatFlag === "json") {
          const lines = nonEmptyLines(result.stdout);
          const parsed = JSON.parse(lines[0]);
          expect(parsed).toHaveProperty("type");
          expect(parsed.type).toBe("observation");
        } else if (formatFlag === "text") {
          expect(result.stdout).toContain(" | ");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (formatFlag === "markdown") {
          expect(result.stdout).toContain("- **type**:");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (formatFlag === "toml") {
          expect(result.stdout).toContain('type = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dt>type</dt>");
          expect(result.stdout).not.toContain('"_tag"');
        }
      }, 15000);

      test("eval advances phase with size (Record)", async () => {
        if (sessionId === undefined) return;
        const result = await runCli([
          "eval",
          "test reflection for format e2e",
          "--session",
          sessionId,
          "--size",
          "TRIVIAL",
          "-f",
          formatFlag,
        ]);
        expect(result.exitCode).toBe(0);

        if (formatFlag === "json") {
          const lines = nonEmptyLines(result.stdout);
          const parsed = JSON.parse(lines[0]);
          expect(parsed).toHaveProperty("session");
          expect(parsed).toHaveProperty("phase");
        } else if (formatFlag === "text") {
          expect(result.stdout).toContain(" | ");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (formatFlag === "markdown") {
          expect(result.stdout).toContain("- **session**:");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (formatFlag === "toml") {
          expect(result.stdout).toContain('session = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dt>session</dt>");
          expect(result.stdout).not.toContain('"_tag"');
        }
      }, 15000);

      test("state with id returns Document with session data", async () => {
        if (sessionId === undefined) return;
        const result = await runCli(["state", sessionId, "-f", formatFlag]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(sessionId);

        if (formatFlag === "json") {
          expect(result.stdout).toContain(sessionId);
          const lines = nonEmptyLines(result.stdout);
          const jsonLine = Arr.findFirst(lines, (l) => {
            try {
              const p = JSON.parse(l);
              return typeof p === "object" && p !== null && "session" in p;
            } catch {
              return false;
            }
          });
          expect(Option.isSome(jsonLine)).toBe(true);
        } else if (formatFlag === "text") {
          expect(result.stdout).toContain(sessionId);
        } else if (formatFlag === "markdown") {
          expect(result.stdout).toContain("```json");
          expect(result.stdout).toContain("```");
          expect(result.stdout).toContain(sessionId);
        } else if (formatFlag === "toml") {
          expect(result.stdout).toContain("# mediaType: json");
          expect(result.stdout).toContain(sessionId);
        } else {
          expect(result.stdout).toContain("<pre>");
          expect(result.stdout).toContain(sessionId);
        }
      }, 15000);

      test("state listing includes session (Record)", async () => {
        if (sessionId === undefined) return;
        const result = await runCli(["state", "-f", formatFlag]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(sessionId as string);

        if (formatFlag === "json") {
          const lines = nonEmptyLines(result.stdout);
          for (const line of lines) {
            const parsed = JSON.parse(line);
            expect(parsed).not.toHaveProperty("_tag");
          }
        } else if (formatFlag === "text") {
          expect(result.stdout).toContain(" | ");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (formatFlag === "markdown") {
          expect(result.stdout).toContain("- **session**:");
          expect(result.stdout).not.toContain('"_tag"');
        } else if (formatFlag === "toml") {
          expect(result.stdout).toContain('session = "');
          expect(result.stdout).not.toContain('"_tag"');
        } else {
          expect(result.stdout).toContain("<dt>session</dt>");
          expect(result.stdout).not.toContain('"_tag"');
        }
      }, 15000);

      test("drop cleans up session (Line)", async () => {
        if (sessionId === undefined) return;
        const result = await runCli(["drop", sessionId, "-f", formatFlag]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("dropped");

        if (formatFlag === "json") {
          expect(result.stdout).toContain("dropped");
        } else {
          expect(result.stdout).not.toContain('"_tag"');
        }
        sessionId = undefined;
      }, 15000);
    });
  }
});
