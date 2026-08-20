import { describe, test } from "bun:test";
import {
  a,
  br,
  comment,
  div,
  element,
  fromAst,
  h,
  hr,
  htmlDoc,
  img,
  ol,
  p,
  parse,
  parseToAst,
  prettyPrintDoc,
  prettyPrintNode,
  span,
  table,
  text,
  ul,
  voidElement,
} from "../../../Html";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const fixture = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Benchmark Fixture</title>
  </head>
  <body>
    <div class="container">
      <h1>Hello World</h1>
      <p>This is a <span class="highlight">benchmark</span> fixture.</p>
      <div class="nested">
        <div class="deep">
          <a href="https://example.com">Link</a>
          <img src="photo.jpg" alt="A photo">
          <br>
          <hr>
        </div>
      </div>
      <ul>
        <li>Item one</li>
        <li>Item two</li>
        <li>Item three</li>
      </ul>
      <table>
        <thead>
          <tr><th>Name</th><th>Age</th><th>City</th></tr>
        </thead>
        <tbody>
          <tr><td>Alice</td><td>30</td><td>Berlin</td></tr>
          <tr><td>Bob</td><td>25</td><td>Tokyo</td></tr>
        </tbody>
      </table>
      <!-- end of content -->
    </div>
  </body>
</html>`;

const nestedNode = div(
  [{ key: "class", value: "outer" }],
  div(
    [{ key: "class", value: "inner" }],
    p("Hello world"),
    span([{ key: "class", value: "tag" }], text("label")),
    ul(["one", "two", "three"]),
  ),
  table(
    ["Name", "Score"],
    [
      ["Alice", "100"],
      ["Bob", "95"],
    ],
  ),
);

const doc = htmlDoc(nestedNode, "html");

describe("construction", () => {
  test("element()", () => {
    measure("element()", () => {
      element("section", [{ key: "id", value: "main" }], text("content"));
    });
  });

  test("text()", () => {
    measure("text()", () => {
      text("hello world");
    });
  });

  test("comment()", () => {
    measure("comment()", () => {
      comment("a comment");
    });
  });

  test("voidElement()", () => {
    measure("voidElement()", () => {
      voidElement("input", [{ key: "type", value: "text" }]);
    });
  });

  test("htmlDoc()", () => {
    measure("htmlDoc()", () => {
      htmlDoc(element("html", []), "html");
    });
  });

  test("div()", () => {
    measure("div()", () => {
      div([{ key: "class", value: "box" }], text("inside"));
    });
  });

  test("span()", () => {
    measure("span()", () => {
      span([{ key: "class", value: "hl" }], text("word"));
    });
  });

  test("p()", () => {
    measure("p()", () => {
      p("paragraph text");
    });
  });

  test("h()", () => {
    measure("h()", () => {
      h(2, "heading");
    });
  });

  test("a()", () => {
    measure("a()", () => {
      a("https://example.com", "click me");
    });
  });

  test("img()", () => {
    measure("img()", () => {
      img("photo.png", "alt text");
    });
  });

  test("br()", () => {
    measure("br()", () => {
      br();
    });
  });

  test("hr()", () => {
    measure("hr()", () => {
      hr();
    });
  });

  test("ul()", () => {
    measure("ul()", () => {
      ul(["one", "two", "three", "four"]);
    });
  });

  test("ol()", () => {
    measure("ol()", () => {
      ol(["first", "second", "third"]);
    });
  });

  test("table()", () => {
    measure("table()", () => {
      table(
        ["A", "B", "C"],
        [
          ["1", "2", "3"],
          ["4", "5", "6"],
        ],
      );
    });
  });
});

describe("rendering", () => {
  test("prettyPrintNode() — nested structure", () => {
    measure("prettyPrintNode() — nested structure", () => {
      prettyPrintNode(nestedNode);
    });
  });

  test("prettyPrintDoc()", () => {
    measure("prettyPrintDoc()", () => {
      prettyPrintDoc(doc);
    });
  });

  test("fromAst()", () => {
    measure("fromAst()", () => {
      fromAst(doc);
    });
  });
});

describe("parsing", () => {
  test("parse() — realistic fixture", () => {
    measure("parse() — realistic fixture", () => {
      parse(fixture);
    });
  });

  test("parseToAst() — realistic fixture", () => {
    measure("parseToAst() — realistic fixture", () => {
      parseToAst(fixture);
    });
  });
});
