import { describe, test, expect } from "bun:test"
import { parse, parseFrontmatter, prettyPrintDoc, doc, map, list, scalar } from "../Yaml"

describe("parse", () => {
  test("simple key-value produces object", () => {
    const result = parse("name: hello\nage: 30")
    expect(result).toEqual({ name: "hello", age: 30 })
  })

  test("nested map produces nested object", () => {
    const input = "parent:\n  child: value\n  other: 42"
    const result = parse(input)
    expect(result).toEqual({ parent: { child: "value", other: 42 } })
  })

  test("list produces array", () => {
    const input = "- one\n- two\n- three"
    const result = parse(input)
    expect(result).toEqual(["one", "two", "three"])
  })

  test("scalars: numbers", () => {
    expect(parse("value: 42")).toEqual({ value: 42 })
    expect(parse("value: 3.14")).toEqual({ value: 3.14 })
  })

  test("scalars: booleans", () => {
    expect(parse("value: true")).toEqual({ value: true })
    expect(parse("value: false")).toEqual({ value: false })
  })

  test("scalars: null", () => {
    expect(parse("value: null")).toEqual({ value: null })
    expect(parse("value: ~")).toEqual({ value: null })
  })

  test("scalars: quoted strings", () => {
    expect(parse('value: "hello"')).toEqual({ value: "hello" })
    expect(parse("value: 'world'")).toEqual({ value: "world" })
  })

  test("empty input returns null", () => {
    expect(parse("")).toBe(null)
    expect(parse("   \n  \n")).toBe(null)
  })
})

describe("parseFrontmatter", () => {
  test("valid frontmatter extracts fm and body", () => {
    const input = "---\nname: test\ntype: project\n---\nThis is the body"
    const result = parseFrontmatter(input)
    expect(result).not.toBe(null)
    expect(result!.fm).toEqual({ name: "test", type: "project" })
    expect(result!.body).toBe("This is the body")
  })

  test("no delimiters returns null", () => {
    const input = "just some text without frontmatter"
    expect(parseFrontmatter(input)).toBe(null)
  })
})

describe("prettyPrintDoc", () => {
  test("roundtrip: parse(prettyPrintDoc(doc)) matches structure", () => {
    const original = map([
      { key: "name", value: scalar("test") },
      { key: "version", value: scalar(1) },
      { key: "items", value: list([scalar("a"), scalar("b")]) },
      { key: "nested", value: map([
        { key: "inner", value: scalar(true) },
      ]) },
    ])
    const printed = prettyPrintDoc(doc(original))
    const parsed = parse(printed)
    expect(parsed).toEqual({
      name: "test",
      version: 1,
      items: ["a", "b"],
      nested: { inner: true },
    })
  })
})
