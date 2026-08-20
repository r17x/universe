import { describe, test, expect } from "bun:test";
import {
  parse,
  findSections,
  hasSection,
  codeBlocksByLanguage,
  shellCodeBlocks,
  hasMultiLineCodeBlocks,
  hasHeadingAtLevel,
  sectionHeaders,
  hasListItems,
  containsKeyword,
  isAbsolutePath,
  findAbsolutePaths,
  findFileReferences,
  isValidSkillName,
  hasSecretAssignment,
} from "../Markdown";

describe("parse", () => {
  test("headings parsed with correct level, text, and line", () => {
    const doc = parse("# H1\n## H2\n### H3");
    expect(doc.headings).toHaveLength(3);
    expect(doc.headings[0]).toEqual({ level: 1, text: "H1", line: 0 });
    expect(doc.headings[1]).toEqual({ level: 2, text: "H2", line: 1 });
    expect(doc.headings[2]).toEqual({ level: 3, text: "H3", line: 2 });
  });

  test("code block with language tag", () => {
    const doc = parse("```bash\necho hello\n```");
    expect(doc.codeBlocks).toHaveLength(1);
    expect(doc.codeBlocks[0].language).toBe("bash");
    expect(doc.codeBlocks[0].content).toBe("echo hello");
    expect(doc.codeBlocks[0].lines).toEqual(["echo hello"]);
    expect(doc.codeBlocks[0].line).toBe(0);
  });

  test("multiple code blocks with different languages", () => {
    const doc = parse("```ts\nconst x = 1\n```\ntext\n```py\nprint(1)\n```");
    expect(doc.codeBlocks).toHaveLength(2);
    expect(doc.codeBlocks[0].language).toBe("ts");
    expect(doc.codeBlocks[0].content).toBe("const x = 1");
    expect(doc.codeBlocks[1].language).toBe("py");
    expect(doc.codeBlocks[1].content).toBe("print(1)");
  });

  test("sections with heading, body, and code blocks", () => {
    const doc = parse("## Section A\nsome text\n## Section B\nother text");
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].heading.text).toBe("Section A");
    expect(doc.sections[0].body).toBe("some text");
    expect(doc.sections[1].heading.text).toBe("Section B");
    expect(doc.sections[1].body).toBe("other text");
  });

  test("code blocks within sections are scoped correctly", () => {
    const doc = parse("## A\n```bash\necho a\n```\n## B\n```py\nprint(1)\n```");
    expect(doc.sections[0].codeBlocks).toHaveLength(1);
    expect(doc.sections[0].codeBlocks[0].language).toBe("bash");
    expect(doc.sections[1].codeBlocks).toHaveLength(1);
    expect(doc.sections[1].codeBlocks[0].language).toBe("py");
  });

  test("empty input produces empty document", () => {
    const doc = parse("");
    expect(doc.headings).toHaveLength(0);
    expect(doc.codeBlocks).toHaveLength(0);
    expect(doc.sections).toHaveLength(0);
  });

  test("no headings preserves body", () => {
    const doc = parse("just some text\nmore text");
    expect(doc.headings).toHaveLength(0);
    expect(doc.sections).toHaveLength(0);
    expect(doc.body).toBe("just some text\nmore text");
  });

  test("headings inside code blocks are ignored", () => {
    const doc = parse("## Real heading\n```\n## Not a heading\n```");
    expect(doc.headings).toHaveLength(1);
    expect(doc.headings[0].text).toBe("Real heading");
  });

  test("heading without space after # is not parsed", () => {
    const doc = parse("##NoSpace");
    expect(doc.headings).toHaveLength(0);
  });

  test("heading levels 1 through 6", () => {
    const doc = parse("# L1\n## L2\n### L3\n#### L4\n##### L5\n###### L6");
    expect(doc.headings).toHaveLength(6);
    expect(doc.headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("code block with no language tag", () => {
    const doc = parse("```\ncode\n```");
    expect(doc.codeBlocks).toHaveLength(1);
    expect(doc.codeBlocks[0].language).toBe("");
  });
});

describe("findSections / hasSection", () => {
  const doc = parse("## When to use\nuse it here\n## Trigger Conditions\nfire when ready");

  test("case insensitive section search", () => {
    expect(hasSection(doc, "when")).toBe(true);
  });

  test("partial match on section heading", () => {
    expect(hasSection(doc, "trigger")).toBe(true);
  });

  test("no match returns false", () => {
    expect(hasSection(doc, "nonexistent")).toBe(false);
  });

  test("findSections returns correct body content", () => {
    const results = findSections(doc, "trigger");
    expect(results).toHaveLength(1);
    expect(results[0].body).toBe("fire when ready");
  });
});

describe("codeBlocksByLanguage / shellCodeBlocks", () => {
  const doc = parse("```bash\necho 1\n```\n```ts\nconst x = 1\n```\n```py\nprint(1)\n```");

  test("filter by specific language", () => {
    const blocks = codeBlocksByLanguage(doc, "bash");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("bash");
  });

  test("shellCodeBlocks matches sh, bash, shell, zsh", () => {
    const shellDoc = parse("```sh\na\n```\n```bash\nb\n```\n```shell\nc\n```\n```zsh\nd\n```");
    const blocks = shellCodeBlocks(shellDoc);
    expect(blocks).toHaveLength(4);
  });

  test("no shell blocks returns empty", () => {
    const tsDoc = parse("```ts\nconst x = 1\n```");
    expect(shellCodeBlocks(tsDoc)).toHaveLength(0);
  });
});

describe("hasMultiLineCodeBlocks", () => {
  test("multi-line code block returns true", () => {
    const doc = parse("```bash\nline 1\nline 2\n```");
    expect(hasMultiLineCodeBlocks(doc)).toBe(true);
  });

  test("single-line code block returns false", () => {
    const doc = parse("```bash\nonly one\n```");
    expect(hasMultiLineCodeBlocks(doc)).toBe(false);
  });

  test("empty code block returns false", () => {
    const doc = parse("```bash\n```");
    expect(hasMultiLineCodeBlocks(doc)).toBe(false);
  });
});

describe("sectionHeaders / hasHeadingAtLevel", () => {
  const doc = parse("# Title\n## Section\n### Sub");

  test("sectionHeaders returns only level-2 headings", () => {
    const headers = sectionHeaders(doc);
    expect(headers).toHaveLength(1);
    expect(headers[0].text).toBe("Section");
  });

  test("hasHeadingAtLevel detects levels correctly", () => {
    expect(hasHeadingAtLevel(doc, 1)).toBe(true);
    expect(hasHeadingAtLevel(doc, 2)).toBe(true);
    expect(hasHeadingAtLevel(doc, 3)).toBe(true);
    expect(hasHeadingAtLevel(doc, 4)).toBe(false);
  });
});

describe("hasListItems", () => {
  test("unordered dash list", () => {
    expect(hasListItems(parse("- item"))).toBe(true);
  });

  test("unordered star list", () => {
    expect(hasListItems(parse("* item"))).toBe(true);
  });

  test("ordered list", () => {
    expect(hasListItems(parse("1. item"))).toBe(true);
  });

  test("multi-digit ordered list", () => {
    expect(hasListItems(parse("10. item"))).toBe(true);
  });

  test("no list items", () => {
    expect(hasListItems(parse("just text"))).toBe(false);
  });

  test("dash without space is not a list", () => {
    expect(hasListItems(parse("-nope"))).toBe(false);
  });
});

describe("containsKeyword", () => {
  test("case insensitive match", () => {
    expect(containsKeyword("NEVER do this", ["never"])).toBe(true);
  });

  test("multiple keywords matches any", () => {
    expect(containsKeyword("hello", ["world", "hello"])).toBe(true);
  });

  test("no match returns false", () => {
    expect(containsKeyword("foo", ["bar"])).toBe(false);
  });
});

describe("isAbsolutePath / findAbsolutePaths", () => {
  test("absolute paths detected", () => {
    expect(isAbsolutePath("/Users/foo")).toBe(true);
    expect(isAbsolutePath("/home/bar")).toBe(true);
    expect(isAbsolutePath("/etc/config")).toBe(true);
    expect(isAbsolutePath("C:\\Users\\x")).toBe(true);
  });

  test("relative paths not detected", () => {
    expect(isAbsolutePath("nix/modules/home/")).toBe(false);
    expect(isAbsolutePath("./home/foo")).toBe(false);
    expect(isAbsolutePath("the/Users/dir")).toBe(false);
  });

  test("findAbsolutePaths extracts only absolute paths", () => {
    const paths = findAbsolutePaths("check nix/modules/home/ and /Users/r17/file");
    expect(paths).toEqual(["/Users/r17/file"]);
  });

  test("no false positives on relative paths containing segments", () => {
    const paths = findAbsolutePaths(
      "Changes only in nix/modules/home/ or nix/configurations/home/",
    );
    expect(paths).toEqual([]);
  });
});

describe("findFileReferences", () => {
  test("finds skill references with prefix and suffix", () => {
    const refs = findFileReferences(
      "see .claude/skills/verify-nix.md for details",
      ".claude/skills/",
      ".md",
    );
    expect(refs).toEqual([".claude/skills/verify-nix.md"]);
  });

  test("no match returns empty", () => {
    const refs = findFileReferences("no references here", ".claude/skills/", ".md");
    expect(refs).toEqual([]);
  });
});

describe("isValidSkillName", () => {
  test("valid names", () => {
    expect(isValidSkillName("gateway-nix")).toBe(true);
    expect(isValidSkillName("self-anneal")).toBe(true);
    expect(isValidSkillName("verify1")).toBe(true);
  });

  test("invalid start character", () => {
    expect(isValidSkillName("1gateway")).toBe(false);
    expect(isValidSkillName("-nix")).toBe(false);
    expect(isValidSkillName("Gateway")).toBe(false);
  });

  test("invalid characters", () => {
    expect(isValidSkillName("gate_way")).toBe(false);
    expect(isValidSkillName("nix.md")).toBe(false);
  });

  test("empty string", () => {
    expect(isValidSkillName("")).toBe(false);
  });
});

describe("hasSecretAssignment", () => {
  test("detects secret assignments", () => {
    expect(hasSecretAssignment('api_key: "sk-abc123"')).toBe(true);
    expect(hasSecretAssignment("password = 'hunter2'")).toBe(true);
    expect(hasSecretAssignment('token: "abc"')).toBe(true);
  });

  test("no assignment operator returns false", () => {
    expect(hasSecretAssignment("api_key mentioned in docs")).toBe(false);
  });

  test("no secret indicator returns false", () => {
    expect(hasSecretAssignment("name: 'value'")).toBe(false);
  });
});
