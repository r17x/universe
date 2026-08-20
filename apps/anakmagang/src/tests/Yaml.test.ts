import { describe, test, expect } from "bun:test";
import {
  parse,
  parseFrontmatter,
  prettyPrintDoc,
  doc,
  map,
  list,
  scalar,
  toAst,
  fromAst,
  parseToAst,
} from "../Yaml";

describe("parse", () => {
  test("simple key-value produces object", () => {
    const result = parse("name: hello\nage: 30");
    expect(result).toEqual({ name: "hello", age: 30 });
  });

  test("nested map produces nested object", () => {
    const input = "parent:\n  child: value\n  other: 42";
    const result = parse(input);
    expect(result).toEqual({ parent: { child: "value", other: 42 } });
  });

  test("list produces array", () => {
    const input = "- one\n- two\n- three";
    const result = parse(input);
    expect(result).toEqual(["one", "two", "three"]);
  });

  test("scalars: numbers", () => {
    expect(parse("value: 42")).toEqual({ value: 42 });
    expect(parse("value: 3.14")).toEqual({ value: 3.14 });
  });

  test("scalars: booleans", () => {
    expect(parse("value: true")).toEqual({ value: true });
    expect(parse("value: false")).toEqual({ value: false });
  });

  test("scalars: null", () => {
    expect(parse("value: null")).toEqual({ value: null });
    expect(parse("value: ~")).toEqual({ value: null });
  });

  test("scalars: quoted strings", () => {
    expect(parse('value: "hello"')).toEqual({ value: "hello" });
    expect(parse("value: 'world'")).toEqual({ value: "world" });
  });

  test("empty input returns null", () => {
    expect(parse("")).toBe(null);
    expect(parse("   \n  \n")).toBe(null);
  });
});

describe("parseFrontmatter", () => {
  test("valid frontmatter extracts fm and body", () => {
    const input = "---\nname: test\ntype: project\n---\nThis is the body";
    const result = parseFrontmatter(input);
    expect(result).not.toBe(null);
    if (!result) return;
    expect(result.fm).toEqual({ name: "test", type: "project" });
    expect(result.body).toBe("This is the body");
  });

  test("no delimiters returns null", () => {
    const input = "just some text without frontmatter";
    expect(parseFrontmatter(input)).toBe(null);
  });
});

describe("prettyPrintDoc", () => {
  test("roundtrip: parse(prettyPrintDoc(doc)) matches structure", () => {
    const original = map([
      { key: "name", value: scalar("test") },
      { key: "version", value: scalar(1) },
      { key: "items", value: list([scalar("a"), scalar("b")]) },
      { key: "nested", value: map([{ key: "inner", value: scalar(true) }]) },
    ]);
    const printed = prettyPrintDoc(doc(original));
    const parsed = parse(printed);
    expect(parsed).toEqual({
      name: "test",
      version: 1,
      items: ["a", "b"],
      nested: { inner: true },
    });
  });
});

describe("toAst", () => {
  test("string → YamlScalar", () => {
    expect(toAst("hello")).toEqual({ type: "YamlScalar", value: "hello" });
  });

  test("number → YamlScalar", () => {
    expect(toAst(42)).toEqual({ type: "YamlScalar", value: 42 });
  });

  test("boolean → YamlScalar", () => {
    expect(toAst(true)).toEqual({ type: "YamlScalar", value: true });
  });

  test("null → YamlScalar", () => {
    expect(toAst(null)).toEqual({ type: "YamlScalar", value: null });
  });

  test("array → YamlList", () => {
    expect(toAst(["a", "b"])).toEqual({
      type: "YamlList",
      items: [
        { type: "YamlScalar", value: "a" },
        { type: "YamlScalar", value: "b" },
      ],
    });
  });

  test("object → YamlMap", () => {
    expect(toAst({ name: "hello" })).toEqual({
      type: "YamlMap",
      entries: [{ key: "name", value: { type: "YamlScalar", value: "hello" } }],
    });
  });

  test("nested", () => {
    expect(toAst({ items: [1, 2] })).toEqual({
      type: "YamlMap",
      entries: [
        {
          key: "items",
          value: {
            type: "YamlList",
            items: [
              { type: "YamlScalar", value: 1 },
              { type: "YamlScalar", value: 2 },
            ],
          },
        },
      ],
    });
  });
});

describe("fromAst", () => {
  test("YamlScalar → value", () => {
    expect(fromAst({ type: "YamlScalar", value: "hello" })).toBe("hello");
  });

  test("YamlList → array", () => {
    const ast = list([scalar("a"), scalar("b")]);
    expect(fromAst(ast)).toEqual(["a", "b"]);
  });

  test("YamlMap → object", () => {
    const ast = map([{ key: "name", value: scalar("hello") }]);
    expect(fromAst(ast)).toEqual({ name: "hello" });
  });
});

describe("toAst/fromAst roundtrip", () => {
  test("toAst then fromAst is identity", () => {
    const input = { name: "hello", age: 30, items: ["a", "b"], nested: { deep: true } };
    expect(fromAst(toAst(input))).toEqual(input);
  });
});

describe("parseToAst", () => {
  test("returns null for empty input", () => {
    expect(parseToAst("")).toBe(null);
  });

  test("parses simple mapping to AST", () => {
    const ast = parseToAst("name: hello\nage: 30");
    expect(ast).not.toBeNull();
    if (!ast) return;
    expect(ast.type).toBe("YamlMap");
  });

  test("full roundtrip: string → AST → string → AST preserves values", () => {
    const yaml = "name: hello\nage: 30\nitems:\n  - a\n  - b";
    const ast1 = parseToAst(yaml);
    if (!ast1) return;
    const printed = prettyPrintDoc(doc(ast1));
    const ast2 = parseToAst(printed);
    if (!ast2) return;
    expect(fromAst(ast2)).toEqual(fromAst(ast1));
  });
});
