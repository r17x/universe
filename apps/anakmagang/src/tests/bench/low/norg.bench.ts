import { describe, test } from "bun:test";
import {
  codeBlock,
  definition,
  fromAst,
  heading,
  horizontalRule,
  list,
  meta,
  norgDoc,
  paragraph,
  parse,
  parseToAst,
  prettyPrintDoc,
  quote,
  tag,
} from "../../../Norg";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const fixture = `@document.meta
title: Session Report
author: r17x
created: 2026-05-22
@end

* Overview
This document demonstrates norg syntax for benchmarking purposes.
It contains multiple node types exercised in combination.

** Nested Heading
A paragraph under a nested heading with some detail.

- First unordered item
- Second unordered item
- Third unordered item

~ Step one
~ Step two
~ Step three

> Quoted wisdom from the ancients.
> Spanning multiple lines of thought.

@code typescript
const greet = (name: string): string =>
  \`Hello, \${name}!\`

console.log(greet("world"))
@end

$ Norg
A markup language designed for structured note-taking.

---

* Implementation Notes

|example usage
  This is a standard tag example.
|end

@embed image
diagram.png
@end

Another paragraph to close out the document.
`;

const parsedDoc = parseToAst(fixture);

describe("construction", () => {
  test("heading()", () => {
    measure("heading()", () => {
      heading(2, "Benchmark Heading");
    });
  });

  test("paragraph()", () => {
    measure("paragraph()", () => {
      paragraph("Some body text for the paragraph node.");
    });
  });

  test("list() — unordered", () => {
    measure("list() — unordered", () => {
      list(["alpha", "beta", "gamma"], false);
    });
  });

  test("list() — ordered", () => {
    measure("list() — ordered", () => {
      list(["first", "second", "third"], true);
    });
  });

  test("codeBlock()", () => {
    measure("codeBlock()", () => {
      codeBlock("typescript", "const x = 42");
    });
  });

  test("quote()", () => {
    measure("quote()", () => {
      quote("A memorable quote\nspanning two lines");
    });
  });

  test("definition()", () => {
    measure("definition()", () => {
      definition("Term", "The body of the definition");
    });
  });

  test("tag() — verbatim", () => {
    measure("tag() — verbatim", () => {
      tag("embed", "image", "diagram.png", true);
    });
  });

  test("tag() — standard", () => {
    measure("tag() — standard", () => {
      tag("example", "usage", "content here", false);
    });
  });

  test("horizontalRule()", () => {
    measure("horizontalRule()", () => {
      horizontalRule();
    });
  });

  test("meta()", () => {
    measure("meta()", () => {
      meta([
        { key: "title", value: "Bench" },
        { key: "author", value: "r17x" },
      ]);
    });
  });

  test("norgDoc()", () => {
    measure("norgDoc()", () => {
      norgDoc(
        [heading(1, "Title"), paragraph("Body"), codeBlock("ts", "1+1")],
        meta([{ key: "title", value: "Doc" }]),
      );
    });
  });
});

describe("parsing", () => {
  test("parseToAst() — full fixture", () => {
    measure("parseToAst() — full fixture", () => {
      parseToAst(fixture);
    });
  });

  test("parse() — full fixture", () => {
    measure("parse() — full fixture", () => {
      parse(fixture);
    });
  });
});

describe("rendering", () => {
  test("prettyPrintDoc() — full document", () => {
    measure("prettyPrintDoc() — full document", () => {
      prettyPrintDoc(parsedDoc);
    });
  });

  test("fromAst() — round-trip render", () => {
    measure("fromAst() — round-trip render", () => {
      fromAst(parsedDoc);
    });
  });

  test("fromAst(parseToAst(fixture)) — full round-trip", () => {
    measure("fromAst(parseToAst(fixture)) — full round-trip", () => {
      fromAst(parseToAst(fixture));
    });
  });
});
