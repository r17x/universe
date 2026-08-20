import { describe, test, expect } from "bun:test";
import { parseToAst, fromAst } from "../Norg";

describe("headings", () => {
  test("single heading level 1", () => {
    const doc = parseToAst("* Title");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "NorgHeading", level: 1, text: "Title" });
  });

  test("multi-level headings 1 through 4", () => {
    const doc = parseToAst("* L1\n** L2\n*** L3\n**** L4");
    expect(doc.nodes).toHaveLength(4);
    expect(doc.nodes.map((n) => (n.type === "NorgHeading" ? n.level : -1))).toEqual([1, 2, 3, 4]);
    expect(doc.nodes.map((n) => (n.type === "NorgHeading" ? n.text : ""))).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
    ]);
  });

  test("heading without space after * is NOT a heading", () => {
    const doc = parseToAst("*NoSpace");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0].type).toBe("NorgParagraph");
  });
});

describe("paragraphs", () => {
  test("plain text becomes NorgParagraph", () => {
    const doc = parseToAst("hello world");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toEqual({ type: "NorgParagraph", text: "hello world" });
  });

  test("multi-line paragraph from consecutive non-empty lines", () => {
    const doc = parseToAst("line one\nline two\nline three");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0].type).toBe("NorgParagraph");
    if (doc.nodes[0].type === "NorgParagraph") {
      expect(doc.nodes[0].text).toBe("line one\nline two\nline three");
    }
  });

  test("empty input produces empty nodes array", () => {
    const doc = parseToAst("");
    expect(doc.nodes).toHaveLength(0);
  });
});

describe("lists", () => {
  test("unordered list with dash prefix", () => {
    const doc = parseToAst("- item1\n- item2");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgList");
    if (node.type === "NorgList") {
      expect(node.ordered).toBe(false);
      expect(node.items).toEqual(["item1", "item2"]);
    }
  });

  test("ordered list with tilde prefix", () => {
    const doc = parseToAst("~ first\n~ second");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgList");
    if (node.type === "NorgList") {
      expect(node.ordered).toBe(true);
      expect(node.items).toEqual(["first", "second"]);
    }
  });

  test("TODO items strip status markers", () => {
    const doc = parseToAst("- ( ) unchecked\n- (x) done");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgList");
    if (node.type === "NorgList") {
      expect(node.items).toEqual(["unchecked", "done"]);
    }
  });
});

describe("code blocks", () => {
  test("code block with language", () => {
    const doc = parseToAst("@code norg\ncontent\n@end");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgCodeBlock");
    if (node.type === "NorgCodeBlock") {
      expect(node.language).toBe("norg");
      expect(node.content).toBe("content");
    }
  });

  test("code block with no language", () => {
    const doc = parseToAst("@code\nstuff\n@end");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgCodeBlock");
    if (node.type === "NorgCodeBlock") {
      expect(node.language).toBe("");
      expect(node.content).toBe("stuff");
    }
  });

  test("unclosed code block consumes to EOF", () => {
    const doc = parseToAst("@code lua\nline1\nline2");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgCodeBlock");
    if (node.type === "NorgCodeBlock") {
      expect(node.language).toBe("lua");
      expect(node.content).toBe("line1\nline2");
    }
  });
});

describe("document metadata", () => {
  test("metadata extracted as doc.meta", () => {
    const doc = parseToAst("@document.meta\ntitle: Test\nauthors: r17\n@end");
    expect(doc.meta).toBeDefined();
    if (doc.meta) {
      expect(doc.meta.entries).toEqual([
        { key: "title", value: "Test" },
        { key: "authors", value: "r17" },
      ]);
    }
  });

  test("metadata not in nodes array", () => {
    const doc = parseToAst("@document.meta\ntitle: Test\n@end\n\n* Heading");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0].type).toBe("NorgHeading");
    expect(doc.meta).toBeDefined();
  });
});

describe("quotes", () => {
  test("multi-line quote", () => {
    const doc = parseToAst("> line1\n> line2");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgQuote");
    if (node.type === "NorgQuote") {
      expect(node.content).toBe("line1\nline2");
    }
  });
});

describe("definitions", () => {
  test("term and body parsed correctly", () => {
    const doc = parseToAst("$ Term\nBody text.");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgDefinition");
    if (node.type === "NorgDefinition") {
      expect(node.term).toBe("Term");
      expect(node.body).toBe("Body text.");
    }
  });
});

describe("horizontal rules", () => {
  test("three dashes", () => {
    const doc = parseToAst("---");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0].type).toBe("NorgHorizontalRule");
  });

  test("five dashes also works", () => {
    const doc = parseToAst("-----");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0].type).toBe("NorgHorizontalRule");
  });
});

describe("tags", () => {
  test("standard tag with pipe prefix", () => {
    const doc = parseToAst("|example\ncontent\n|end");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgTag");
    if (node.type === "NorgTag") {
      expect(node.name).toBe("example");
      expect(node.verbatim).toBe(false);
      expect(node.content).toBe("content");
    }
  });

  test("verbatim tag with @ prefix", () => {
    const doc = parseToAst("@custom param\ncontent\n@end");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgTag");
    if (node.type === "NorgTag") {
      expect(node.name).toBe("custom");
      expect(node.verbatim).toBe(true);
      expect(node.parameters).toBe("param");
      expect(node.content).toBe("content");
    }
  });

  test("standard tag with parameters", () => {
    const doc = parseToAst("|tag param1 param2\ncontent\n|end");
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0];
    expect(node.type).toBe("NorgTag");
    if (node.type === "NorgTag") {
      expect(node.name).toBe("tag");
      expect(node.parameters).toBe("param1 param2");
      expect(node.content).toBe("content");
    }
  });
});

describe("round-trip", () => {
  test("parseToAst then fromAst then re-parse yields equivalent AST", () => {
    const input = [
      "@document.meta",
      "title: Round Trip Test",
      "@end",
      "",
      "* Main Heading",
      "",
      "A paragraph of text.",
      "",
      "- alpha",
      "- beta",
      "",
      "~ first",
      "~ second",
      "",
      "@code typescript",
      "const x = 1",
      "@end",
      "",
      "> quoted line",
      "",
      "$ Term",
      "Definition body.",
      "",
      "---",
    ].join("\n");

    const ast1 = parseToAst(input);
    const printed = fromAst(ast1);
    const ast2 = parseToAst(printed);

    expect(ast2.nodes).toEqual(ast1.nodes);
    expect(JSON.stringify(ast2.meta)).toBe(JSON.stringify(ast1.meta));
  });
});
