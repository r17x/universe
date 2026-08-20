import { describe, test, expect } from "bun:test";
import {
  heading,
  paragraph,
  list,
  codeBlock,
  table,
  mdDoc,
  prettyPrintMdDoc,
  parseToAst,
  fromAst,
} from "../Markdown";

describe("prettyPrintMdDoc / individual nodes", () => {
  test("heading level 1", () => {
    const result = prettyPrintMdDoc(mdDoc(heading(1, "Title")));
    expect(result).toBe("# Title");
  });

  test("heading level 3", () => {
    const result = prettyPrintMdDoc(mdDoc(heading(3, "Sub")));
    expect(result).toBe("### Sub");
  });

  test("paragraph", () => {
    const result = prettyPrintMdDoc(mdDoc(paragraph("hello world")));
    expect(result).toBe("hello world");
  });

  test("unordered list", () => {
    const result = prettyPrintMdDoc(mdDoc(list(["a", "b", "c"])));
    expect(result).toBe("- a\n- b\n- c");
  });

  test("ordered list", () => {
    const result = prettyPrintMdDoc(mdDoc(list(["a", "b"], true)));
    expect(result).toBe("1. a\n2. b");
  });

  test("code block with language", () => {
    const result = prettyPrintMdDoc(mdDoc(codeBlock("ts", "const x = 1")));
    expect(result).toBe("```ts\nconst x = 1\n```");
  });

  test("code block without language", () => {
    const result = prettyPrintMdDoc(mdDoc(codeBlock("", "raw")));
    expect(result).toBe("```\nraw\n```");
  });
});

describe("table formatting", () => {
  test("basic table", () => {
    const result = prettyPrintMdDoc(
      mdDoc(
        table(
          ["Name", "Age"],
          [
            ["Alice", "30"],
            ["Bob", "25"],
          ],
        ),
      ),
    );
    expect(result).toBe("| Name | Age |\n|---|---|\n| Alice | 30 |\n| Bob | 25 |");
  });

  test("pipe escaping in cells", () => {
    const result = prettyPrintMdDoc(mdDoc(table(["A|B"], [["C|D"]])));
    expect(result).toContain("A\\|B");
    expect(result).toContain("C\\|D");
    expect(result).toBe("| A\\|B |\n|---|\n| C\\|D |");
  });

  test("empty rows produces header and separator only", () => {
    const result = prettyPrintMdDoc(mdDoc(table(["H1", "H2"], [])));
    expect(result).toBe("| H1 | H2 |\n|---|---|");
  });
});

describe("document composition", () => {
  test("nodes separated by double newline", () => {
    const result = prettyPrintMdDoc(mdDoc(heading(1, "Title"), paragraph("body"), list(["x"])));
    expect(result).toBe("# Title\n\nbody\n\n- x");
  });
});

describe("integration: drop.cmd.ts output", () => {
  test("reproduces drop feedback markdown", () => {
    const sid = "test-session";
    const reflections = [{ phase: "setup", reflection: "explored deeply" }];
    const observations = ["found issue X"];

    const legacyLines = [
      `# Drop feedback: ${sid}`,
      "",
      ...(reflections.length > 0
        ? ["## Reflections", "", ...reflections.map((r) => `- [${r.phase}] ${r.reflection}`), ""]
        : []),
      ...(observations.length > 0
        ? ["## Observations", "", ...observations.map((o) => `- ${o}`), ""]
        : []),
    ];
    const legacyOutput = legacyLines.join("\n").trim();

    const builderOutput = prettyPrintMdDoc(
      mdDoc(
        heading(1, `Drop feedback: ${sid}`),
        heading(2, "Reflections"),
        list(reflections.map((r) => `[${r.phase}] ${r.reflection}`)),
        heading(2, "Observations"),
        list(observations.map((o) => o)),
      ),
    );

    expect(builderOutput).toBe(legacyOutput);
  });
});

describe("integration: MachineLoader phase table", () => {
  test("produces valid GFM table", () => {
    const result = prettyPrintMdDoc(
      mdDoc(
        table(
          ["#", "Phase", "Exit Question"],
          [
            ["1", "setup", "What assumptions am I carrying?"],
            ["2", "triage", "Am I solving the right problem?"],
          ],
        ),
      ),
    );
    expect(result).toBe(
      "| # | Phase | Exit Question |\n" +
        "|---|---|---|\n" +
        "| 1 | setup | What assumptions am I carrying? |\n" +
        "| 2 | triage | Am I solving the right problem? |",
    );
  });
});

describe("parseToAst", () => {
  test("heading", () => {
    const doc = parseToAst("# Title");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "MdHeading", level: 1, text: "Title" });
  });

  test("paragraph", () => {
    const doc = parseToAst("Some text here");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "MdParagraph", text: "Some text here" });
  });

  test("unordered list", () => {
    const doc = parseToAst("- a\n- b\n- c");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "MdList", items: ["a", "b", "c"], ordered: false });
  });

  test("ordered list", () => {
    const doc = parseToAst("1. first\n2. second");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "MdList", items: ["first", "second"], ordered: true });
  });

  test("code block", () => {
    const doc = parseToAst("```ts\nconst x = 1\n```");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "MdCodeBlock", language: "ts", content: "const x = 1" });
  });

  test("table", () => {
    const doc = parseToAst("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0].type).toBe("MdTable");
  });

  test("empty input", () => {
    const doc = parseToAst("");
    expect(doc.nodes).toHaveLength(0);
  });

  test("mixed content", () => {
    const md = "# Title\n\nSome text.\n\n- a\n- b\n\n```ts\ncode\n```";
    const doc = parseToAst(md);
    expect(doc.nodes.map((n) => n.type)).toEqual([
      "MdHeading",
      "MdParagraph",
      "MdList",
      "MdCodeBlock",
    ]);
  });
});

describe("fromAst", () => {
  test("is alias for prettyPrintMdDoc", () => {
    const doc = mdDoc(heading(1, "Test"), paragraph("body"));
    expect(fromAst(doc)).toBe(prettyPrintMdDoc(doc));
  });
});

describe("parseToAst/fromAst roundtrip", () => {
  test("roundtrip is stable", () => {
    const md =
      "# Title\n\nBody text.\n\n## Section\n\n- item a\n- item b\n\n```ts\nconst x = 1\n```\n\n| Name | Age |\n|---|---|\n| Alice | 30 |";
    const output1 = fromAst(parseToAst(md));
    const output2 = fromAst(parseToAst(output1));
    expect(output2).toBe(output1);
  });
});
