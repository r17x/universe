import { describe, test } from "bun:test";
import {
  doc,
  fromAst,
  list,
  map,
  parse,
  parseFrontmatter,
  parseToAst,
  prettyPrintDoc,
  quoteYaml,
  scalar,
  serializeFrontmatter,
  toAst,
} from "../../../Yaml";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const nestedMap = map([
  { key: "name", value: scalar("anakmagang") },
  { key: "version", value: scalar("0.1.0") },
  { key: "enabled", value: scalar(true) },
  { key: "count", value: scalar(42) },
  { key: "tags", value: list([scalar("cli"), scalar("effect"), scalar("nix")]) },
  {
    key: "config",
    value: map([
      { key: "debug", value: scalar(false) },
      { key: "timeout", value: scalar(3000) },
      { key: "nested", value: map([{ key: "deep", value: scalar("value") }]) },
    ]),
  },
]);

const document = doc(nestedMap, "Generated config");

const multiLineYaml = `name: anakmagang
version: "0.1.0"
enabled: true
count: 42
tags:
  - cli
  - effect
  - nix
  - typescript
config:
  debug: false
  timeout: 3000
  nested:
    deep: value
    items:
      - alpha
      - beta
      - gamma
metadata:
  author: r17
  license: MIT`;

const frontmatterContent = `---
name: session-001
type: feedback
description: "A test session for benchmarking"
updated: 2026-05-22
tags:
  - bench
  - yaml
---
This is the body content of the frontmatter document.
It spans multiple lines and contains some text.`;

const frontmatterEntries = [
  { key: "name", value: scalar("session-001") },
  { key: "type", value: scalar("feedback") },
  { key: "description", value: scalar("A test session") },
  { key: "updated", value: scalar("2026-05-22") },
] as const;

const frontmatterBody = "Body content goes here.\nWith multiple lines.";

const parsedNested = parse(multiLineYaml);
const astFromParsed = parsedNested !== null ? toAst(parsedNested) : scalar(null);

const specialCharsInput = 'value with: colons, "quotes", and #comments';

describe("Yaml — node construction", () => {
  test("scalar()", () => {
    measure("scalar()", () => {
      scalar("hello");
    });
  });

  test("list()", () => {
    measure("list()", () => {
      list([scalar("a"), scalar("b"), scalar("c")]);
    });
  });

  test("map()", () => {
    measure("map()", () => {
      map([
        { key: "x", value: scalar(1) },
        { key: "y", value: scalar(2) },
      ]);
    });
  });

  test("doc()", () => {
    measure("doc()", () => {
      doc(nestedMap, "a comment");
    });
  });
});

describe("Yaml — serialization", () => {
  test("prettyPrintDoc() — nested map with comment", () => {
    measure("prettyPrintDoc() — nested map with comment", () => {
      prettyPrintDoc(document);
    });
  });

  test("serializeFrontmatter()", () => {
    measure("serializeFrontmatter()", () => {
      serializeFrontmatter(frontmatterEntries, frontmatterBody);
    });
  });

  test("quoteYaml() — special characters", () => {
    measure("quoteYaml() — special characters", () => {
      quoteYaml(specialCharsInput);
    });
  });
});

describe("Yaml — parsing", () => {
  test("parse() — multi-line nested YAML", () => {
    measure("parse() — multi-line nested YAML", () => {
      parse(multiLineYaml);
    });
  });

  test("parseFrontmatter() — with frontmatter", () => {
    measure("parseFrontmatter() — with frontmatter", () => {
      parseFrontmatter(frontmatterContent);
    });
  });

  test("parseToAst() — multi-line YAML", () => {
    measure("parseToAst() — multi-line YAML", () => {
      parseToAst(multiLineYaml);
    });
  });
});

describe("Yaml — AST conversion", () => {
  test("toAst() — from parsed object", () => {
    measure("toAst() — from parsed object", () => {
      toAst(parsedNested);
    });
  });

  test("fromAst() — to plain object", () => {
    measure("fromAst() — to plain object", () => {
      fromAst(astFromParsed);
    });
  });

  test("toAst() + fromAst() — round-trip", () => {
    measure("toAst() + fromAst() — round-trip", () => {
      fromAst(toAst(parsedNested));
    });
  });
});
