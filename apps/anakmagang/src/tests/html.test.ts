import { describe, test, expect } from "bun:test";
import {
  element,
  text,
  comment,
  htmlDoc,
  div,
  span,
  p,
  h,
  a,
  img,
  br,
  hr,
  ul,
  ol,
  table,
  prettyPrintNode,
  prettyPrintDoc,
  fromAst,
  parse,
  parseToAst,
} from "../Html";

describe("prettyPrintNode / individual nodes", () => {
  test("text node escapes HTML entities", () => {
    const result = prettyPrintNode(text("a < b & c > d"));
    expect(result).toBe("a &lt; b &amp; c &gt; d");
  });

  test("comment node", () => {
    const result = prettyPrintNode(comment("this is a comment"));
    expect(result).toBe("<!-- this is a comment -->");
  });

  test("void element without attributes", () => {
    const result = prettyPrintNode(br());
    expect(result).toBe("<br>");
  });

  test("void element with attributes", () => {
    const result = prettyPrintNode(img("photo.jpg", "A photo"));
    expect(result).toBe('<img src="photo.jpg" alt="A photo">');
  });

  test("element with text child", () => {
    const result = prettyPrintNode(p("hello"));
    expect(result).toBe("<p>hello</p>");
  });

  test("empty element", () => {
    const result = prettyPrintNode(div([]));
    expect(result).toBe("<div></div>");
  });
});

describe("convenience constructors", () => {
  test("div with children", () => {
    const result = prettyPrintNode(div([], p("one"), p("two")));
    expect(result).toBe("<div>\n  <p>one</p>\n  <p>two</p>\n</div>");
  });

  test("span is inline", () => {
    const result = prettyPrintNode(span([], text("inline")));
    expect(result).toBe("<span>inline</span>");
  });

  test("p shorthand", () => {
    const result = prettyPrintNode(p("paragraph text"));
    expect(result).toBe("<p>paragraph text</p>");
  });

  test("h levels", () => {
    expect(prettyPrintNode(h(1, "Title"))).toBe("<h1>Title</h1>");
    expect(prettyPrintNode(h(3, "Sub"))).toBe("<h3>Sub</h3>");
    expect(prettyPrintNode(h(6, "Deep"))).toBe("<h6>Deep</h6>");
  });

  test("a link", () => {
    const result = prettyPrintNode(a("https://example.com", "Click"));
    expect(result).toBe('<a href="https://example.com">Click</a>');
  });

  test("img", () => {
    const result = prettyPrintNode(img("pic.png", "Alt text"));
    expect(result).toBe('<img src="pic.png" alt="Alt text">');
  });

  test("br and hr", () => {
    expect(prettyPrintNode(br())).toBe("<br>");
    expect(prettyPrintNode(hr())).toBe("<hr>");
  });

  test("ul", () => {
    const result = prettyPrintNode(ul(["a", "b", "c"]));
    expect(result).toBe("<ul>\n  <li>a</li>\n  <li>b</li>\n  <li>c</li>\n</ul>");
  });

  test("ol", () => {
    const result = prettyPrintNode(ol(["first", "second"]));
    expect(result).toBe("<ol>\n  <li>first</li>\n  <li>second</li>\n</ol>");
  });

  test("table", () => {
    const result = prettyPrintNode(table(["Name", "Age"], [["Alice", "30"]]));
    expect(result).toContain("<table>");
    expect(result).toContain("<thead>");
    expect(result).toContain("<th>Name</th>");
    expect(result).toContain("<td>Alice</td>");
    expect(result).toContain("</table>");
  });
});

describe("nested indentation", () => {
  test("deeply nested elements", () => {
    const node = div([], div([], p("deep")));
    const result = prettyPrintNode(node);
    expect(result).toBe("<div>\n  <div>\n    <p>deep</p>\n  </div>\n</div>");
  });

  test("inline elements inside block", () => {
    const node = div([], span([], text("hi")), span([], text("there")));
    const result = prettyPrintNode(node);
    expect(result).toContain("<span>hi</span>");
    expect(result).toContain("<span>there</span>");
  });
});

describe("prettyPrintDoc / document", () => {
  test("document without doctype", () => {
    const doc = htmlDoc(p("hello"));
    const result = prettyPrintDoc(doc);
    expect(result).toBe("<p>hello</p>");
  });

  test("document with doctype", () => {
    const doc = htmlDoc(p("hello"), "html");
    const result = prettyPrintDoc(doc);
    expect(result).toBe("<!DOCTYPE html>\n<p>hello</p>");
  });
});

describe("HTML entity escaping", () => {
  test("escapes < > & in text", () => {
    const result = prettyPrintNode(text('x < y & z > w "q"'));
    expect(result).toBe("x &lt; y &amp; z &gt; w &quot;q&quot;");
  });

  test("escapes attribute values", () => {
    const result = prettyPrintNode(element("div", [{ key: "data-val", value: 'a"b' }]));
    expect(result).toContain('data-val="a&quot;b"');
  });
});

describe("parse / basic HTML", () => {
  test("single element with text", () => {
    const doc = parse("<p>hello</p>");
    expect(doc.root.type).toBe("HtmlElement");
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.tag).toBe("p");
      expect(doc.root.children).toHaveLength(1);
      expect(doc.root.children[0]).toEqual({ type: "HtmlText", content: "hello" });
    }
  });

  test("void element", () => {
    const doc = parse("<br>");
    expect(doc.root.type).toBe("HtmlVoidElement");
    if (doc.root.type === "HtmlVoidElement") {
      expect(doc.root.tag).toBe("br");
    }
  });

  test("self-closing void element", () => {
    const doc = parse("<br/>");
    expect(doc.root.type).toBe("HtmlVoidElement");
    if (doc.root.type === "HtmlVoidElement") {
      expect(doc.root.tag).toBe("br");
    }
  });

  test("void element with attributes", () => {
    const doc = parse('<img src="pic.jpg" alt="photo">');
    expect(doc.root.type).toBe("HtmlVoidElement");
    if (doc.root.type === "HtmlVoidElement") {
      expect(doc.root.tag).toBe("img");
      expect(doc.root.attributes).toEqual([
        { key: "src", value: "pic.jpg" },
        { key: "alt", value: "photo" },
      ]);
    }
  });
});

describe("parse / attributes", () => {
  test("double-quoted attributes", () => {
    const doc = parse('<div class="main" id="app"></div>');
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.attributes).toEqual([
        { key: "class", value: "main" },
        { key: "id", value: "app" },
      ]);
    }
  });

  test("single-quoted attributes", () => {
    const doc = parse("<div class='main'></div>");
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.attributes).toEqual([{ key: "class", value: "main" }]);
    }
  });

  test("boolean attributes", () => {
    const doc = parse("<input disabled>");
    if (doc.root.type === "HtmlVoidElement") {
      expect(doc.root.attributes).toEqual([{ key: "disabled", value: "" }]);
    }
  });
});

describe("parse / comments", () => {
  test("parses HTML comment", () => {
    const doc = parse("<!-- a comment -->");
    expect(doc.root.type).toBe("HtmlComment");
    if (doc.root.type === "HtmlComment") {
      expect(doc.root.text).toBe("a comment");
    }
  });
});

describe("parse / nested structure", () => {
  test("nested elements", () => {
    const doc = parse("<div><p>text</p></div>");
    expect(doc.root.type).toBe("HtmlElement");
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.tag).toBe("div");
      expect(doc.root.children).toHaveLength(1);
      const child = doc.root.children[0];
      expect(child.type).toBe("HtmlElement");
      if (child.type === "HtmlElement") {
        expect(child.tag).toBe("p");
        expect(child.children).toHaveLength(1);
      }
    }
  });

  test("multiple children", () => {
    const doc = parse("<ul><li>a</li><li>b</li></ul>");
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.tag).toBe("ul");
      expect(doc.root.children).toHaveLength(2);
    }
  });
});

describe("parse / doctype", () => {
  test("parses DOCTYPE", () => {
    const doc = parse("<!DOCTYPE html><html><body>hi</body></html>");
    expect(doc.doctype).toBe("html");
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.tag).toBe("html");
    }
  });
});

describe("parse / empty input", () => {
  test("empty string returns default document", () => {
    const doc = parse("");
    expect(doc.root.type).toBe("HtmlElement");
    if (doc.root.type === "HtmlElement") {
      expect(doc.root.tag).toBe("html");
      expect(doc.root.children).toHaveLength(0);
    }
  });
});

describe("roundtrip: fromAst(parseToAst(html))", () => {
  test("simple element roundtrip is stable", () => {
    const html = "<p>hello</p>";
    const output1 = fromAst(parseToAst(html));
    const output2 = fromAst(parseToAst(output1));
    expect(output2).toBe(output1);
  });

  test("nested element roundtrip is stable", () => {
    const html = "<div><p>one</p><p>two</p></div>";
    const output1 = fromAst(parseToAst(html));
    const output2 = fromAst(parseToAst(output1));
    expect(output2).toBe(output1);
  });

  test("void elements roundtrip is stable", () => {
    const html = '<img src="x.jpg" alt="y">';
    const output1 = fromAst(parseToAst(html));
    const output2 = fromAst(parseToAst(output1));
    expect(output2).toBe(output1);
  });

  test("document with doctype roundtrip is stable", () => {
    const html = "<!DOCTYPE html>\n<html><body>hi</body></html>";
    const output1 = fromAst(parseToAst(html));
    const output2 = fromAst(parseToAst(output1));
    expect(output2).toBe(output1);
  });
});

describe("fromAst alias", () => {
  test("fromAst equals prettyPrintDoc", () => {
    const doc = htmlDoc(p("test"), "html");
    expect(fromAst(doc)).toBe(prettyPrintDoc(doc));
  });
});
