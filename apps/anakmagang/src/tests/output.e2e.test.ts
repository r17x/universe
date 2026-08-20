import { describe, test, expect } from "bun:test";
import { Effect } from "effect";
import { Output, text, json, markdown, silent } from "../protocol.Output";
import { Line, Record, Table, Document, Diagnostic, emissionChannel } from "../protocol.Emission";

describe("Output e2e - format functions", () => {
  test("text formats Record as pipe-joined values", () => {
    const emission = Record({
      fields: [
        ["session", "ABC"],
        ["status", "ACTIVE"],
      ],
    });
    const formatted = text(emission);
    expect(formatted).toBe("ABC | ACTIVE");
  });

  test("json formats Record as JSON object from fields", () => {
    const emission = Record({
      fields: [
        ["session", "ABC"],
        ["status", "ACTIVE"],
      ],
    });
    const formatted = json(emission);
    const parsed = JSON.parse(formatted);
    expect(parsed).toEqual({ session: "ABC", status: "ACTIVE" });
  });

  test("markdown formats Record as bullet list", () => {
    const emission = Record({
      fields: [
        ["session", "ABC"],
        ["status", "ACTIVE"],
      ],
    });
    const formatted = markdown(emission);
    expect(formatted).toBe("- **session**: ABC\n- **status**: ACTIVE");
  });

  test("silent produces empty string for all emissions", () => {
    const emissions = [
      Line({ text: "hello" }),
      Record({ fields: [["k", "v"]] }),
      Table({ headers: ["A"], rows: [["1"]] }),
      Document({ content: "body", mediaType: "text" }),
      Diagnostic({ severity: "warn", message: "caution" }),
    ];
    for (const e of emissions) {
      expect(silent(e)).toBe("");
    }
  });
});

describe("Output e2e - layer with format", () => {
  test("Output.withFormat(silent) produces no console output", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const output = yield* Output;
        yield* output.emit(Line({ text: "should not appear" }));
      }).pipe(Effect.provide(Output.withFormat(silent))),
    );
    expect(result).toBeUndefined();
  });

  test("Output.withFormat produces working service", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const output = yield* Output;
        return typeof output.emit;
      }).pipe(Effect.provide(Output.withFormat(text))),
    );
    expect(result).toBe("function");
  });
});

describe("Output e2e - channel routing", () => {
  test("Diagnostic routes to stderr", () => {
    const channel = emissionChannel(Diagnostic({ severity: "error", message: "fail" }));
    expect(channel.channel).toBe("stderr");
  });

  test("Line routes to stdout", () => {
    const channel = emissionChannel(Line({ text: "hello" }));
    expect(channel.channel).toBe("stdout");
  });

  test("Record routes to stdout", () => {
    const channel = emissionChannel(Record({ fields: [] }));
    expect(channel.channel).toBe("stdout");
  });

  test("Table routes to stdout", () => {
    const channel = emissionChannel(Table({ headers: [], rows: [] }));
    expect(channel.channel).toBe("stdout");
  });

  test("Document routes to stdout", () => {
    const channel = emissionChannel(Document({ content: "", mediaType: "json" }));
    expect(channel.channel).toBe("stdout");
  });
});

describe("Output e2e - CLI command emission patterns", () => {
  test("state command pattern: session listing as Record", () => {
    const emission = Record({
      fields: [
        ["session", "01ABC"],
        ["status", "ACTIVE"],
        ["task", "fix bug"],
        ["phase", "implementation"],
      ],
    });
    const formatted = text(emission);
    expect(formatted).toBe("01ABC | ACTIVE | fix bug | implementation");
  });

  test("state command pattern: full state as Document", () => {
    const state = { session: "01ABC", active: true };
    const emission = Document({ content: JSON.stringify(state), mediaType: "json" });
    const formatted = text(emission);
    expect(formatted).toBe(JSON.stringify(state));
  });

  test("start command pattern: session with question", () => {
    const emission = Record({
      fields: [
        ["session", "01ABC"],
        ["phase", "1/setup"],
        ["question", "What assumptions?"],
      ],
    });
    const consoleFormatted = text(emission);
    expect(consoleFormatted).toBe("01ABC | 1/setup | What assumptions?");

    const jsonFormatted = json(emission);
    const parsed = JSON.parse(jsonFormatted);
    expect(parsed).toEqual({ session: "01ABC", phase: "1/setup", question: "What assumptions?" });
  });

  test("logs command pattern: event records", () => {
    const emission = Record({
      fields: [
        ["ts", "2026-01-01T00:00:00Z"],
        ["type", "START"],
        ["task", "fix bug"],
      ],
    });
    const formatted = text(emission);
    expect(formatted).toContain("2026-01-01");
    expect(formatted).toContain("START");
    expect(formatted).toContain("fix bug");
  });

  test("config guard list pattern: Table", () => {
    const emission = Table({
      headers: ["TYPE", "EVENT", "ENABLED"],
      rows: [
        ["agent-first", "PreToolUse", "true"],
        ["block-nix-build", "PreToolUse", "true"],
      ],
    });
    const formatted = text(emission);
    expect(formatted).toContain("TYPE");
    expect(formatted).toContain("agent-first");
    expect(formatted).toContain("block-nix-build");
  });

  test("hook.eval block pattern: Diagnostic error", () => {
    const emission = Diagnostic({ severity: "error", message: "BLOCKED: Cannot edit directly" });
    const formatted = text(emission);
    expect(formatted).toBe("BLOCKED: Cannot edit directly");
    expect(emissionChannel(emission).channel).toBe("stderr");
  });

  test("hook.eval warn pattern: UserPromptSubmit warn as Line (stdout)", () => {
    const emission = Line({ text: "Warning: no active session" });
    const formatted = text(emission);
    expect(formatted).toBe("Warning: no active session");
    expect(emissionChannel(emission).channel).toBe("stdout");
  });

  test("drop command pattern: Diagnostic for errors", () => {
    const emission = Diagnostic({
      severity: "error",
      message: "session-id required (or use --stale)",
    });
    const formatted = text(emission);
    expect(formatted).toBe("session-id required (or use --stale)");
    expect(emissionChannel(emission).channel).toBe("stderr");
  });

  test("audit command pattern: Document for JSON format", () => {
    const reports = [
      {
        target: "test.md",
        type: "agent",
        results: [],
        summary: { passed: 0, warned: 0, failed: 0 },
      },
    ];
    const emission = Document({ content: JSON.stringify(reports), mediaType: "json" });
    const formatted = text(emission);
    expect(JSON.parse(formatted)).toEqual(reports);
  });

  test("markdown format renders Table as markdown table", () => {
    const emission = Table({
      headers: ["TYPE", "EVENT", "ENABLED"],
      rows: [["agent-first", "PreToolUse", "true"]],
    });
    const formatted = markdown(emission);
    expect(formatted).toContain("| TYPE | EVENT | ENABLED |");
    expect(formatted).toContain("| agent-first | PreToolUse | true |");
  });
});
