import { describe, test } from "bun:test";
import {
  Diagnostic,
  Document,
  Line,
  Record,
  Table,
  $is,
  $match,
  emissionChannel,
} from "../../../protocol.Emission";
import { hashString, matchesTool } from "../../../protocol.GuardConfig";
import {
  Allow,
  Block,
  Warn,
  $is as guardIs,
  $match as guardMatch,
} from "../../../protocol.GuardResult";
import { sortByBucket } from "../../../protocol.LatencyBucket";
import { agent, html, json, markdown, norg, silent, text, toml } from "../../../protocol.Output";
import { formatAddress, parseAddress, sessionStream } from "../../../protocol.StreamAddress";
import type { GuardConfig } from "../../../protocol.GuardConfig";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const sampleLine = Line({ text: "hello world" });
const sampleTable = Table({
  headers: ["Name", "Value"],
  rows: [
    ["a", "1"],
    ["b", "2"],
    ["c", "3"],
  ],
});
const sampleDiagnostic = Diagnostic({ severity: "warn", message: "something happened" });

describe("Emission", () => {
  test("Line()", () => {
    measure("Line()", () => {
      Line({ text: "bench" });
    });
  });

  test("Record()", () => {
    measure("Record()", () => {
      Record({ fields: [["k", "v"]] });
    });
  });

  test("Table()", () => {
    measure("Table()", () => {
      Table({ headers: ["A"], rows: [["1"]] });
    });
  });

  test("Document()", () => {
    measure("Document()", () => {
      Document({ content: "x", mediaType: "text" });
    });
  });

  test("Diagnostic()", () => {
    measure("Diagnostic()", () => {
      Diagnostic({ severity: "error", message: "fail" });
    });
  });

  test("emissionChannel()", () => {
    measure("emissionChannel()", () => {
      emissionChannel(sampleLine);
      emissionChannel(sampleDiagnostic);
    });
  });

  test("$is — Line check", () => {
    measure("$is — Line check", () => {
      $is("Line")(sampleLine);
      $is("Line")(sampleDiagnostic);
    });
  });

  test("$match — exhaustive", () => {
    measure("$match — exhaustive", () => {
      $match({
        Line: (e) => e.text,
        Record: (e) => e.fields[0]?.[0] ?? "",
        Table: (e) => e.headers[0] ?? "",
        Document: (e) => e.content,
        Diagnostic: (e) => e.message,
      })(sampleTable);
    });
  });
});

describe("GuardConfig", () => {
  test("matchesTool() — matching", () => {
    measure("matchesTool() — matching", () => {
      matchesTool("Edit|Write", "Edit");
    });
  });

  test("matchesTool() — no match", () => {
    measure("matchesTool() — no match", () => {
      matchesTool("Edit|Write", "Read");
    });
  });

  test("matchesTool() — undefined matcher", () => {
    measure("matchesTool() — undefined matcher", () => {
      matchesTool(undefined, "Edit");
    });
  });

  test("hashString()", () => {
    measure("hashString()", () => {
      hashString("agent-first");
    });
  });

  test("hashString() — long input", () => {
    measure("hashString() — long input", () => {
      hashString("the-quick-brown-fox-jumps-over-the-lazy-dog-1234567890");
    });
  });
});

const allow = Allow();
const warn = Warn({ message: "caution" });
const block = Block({ message: "denied" });

describe("GuardResult", () => {
  test("Allow()", () => {
    measure("Allow()", () => {
      Allow();
    });
  });

  test("Warn()", () => {
    measure("Warn()", () => {
      Warn({ message: "w" });
    });
  });

  test("Block()", () => {
    measure("Block()", () => {
      Block({ message: "b" });
    });
  });

  test("$is — Allow check", () => {
    measure("$is — Allow check", () => {
      guardIs("Allow")(allow);
      guardIs("Allow")(block);
    });
  });

  test("$match — exhaustive", () => {
    measure("$match — exhaustive", () => {
      guardMatch({
        Allow: () => "ok",
        Info: (i) => i.message,
        Warn: (w) => w.message,
        Block: (b) => b.message,
      })(warn);
    });
  });
});

const mockGuards: ReadonlyArray<GuardConfig> = [
  { type: "post-edit" },
  { type: "agent-first" },
  { type: "compaction-gate" },
  { type: "output-location" },
  { type: "iteration-limit" },
] as unknown as ReadonlyArray<GuardConfig>;

describe("LatencyBucket", () => {
  test("sortByBucket() — 5 guards", () => {
    measure("sortByBucket() — 5 guards", () => {
      sortByBucket(mockGuards);
    });
  });
});

describe("Output formatters", () => {
  test("text() — Line", () => {
    measure("text() — Line", () => {
      text(sampleLine);
    });
  });

  test("text() — Table", () => {
    measure("text() — Table", () => {
      text(sampleTable);
    });
  });

  test("json() — Line", () => {
    measure("json() — Line", () => {
      json(sampleLine);
    });
  });

  test("json() — Table", () => {
    measure("json() — Table", () => {
      json(sampleTable);
    });
  });

  test("markdown() — Line", () => {
    measure("markdown() — Line", () => {
      markdown(sampleLine);
    });
  });

  test("markdown() — Table", () => {
    measure("markdown() — Table", () => {
      markdown(sampleTable);
    });
  });

  test("html() — Line", () => {
    measure("html() — Line", () => {
      html(sampleLine);
    });
  });

  test("html() — Table", () => {
    measure("html() — Table", () => {
      html(sampleTable);
    });
  });

  test("norg() — Line", () => {
    measure("norg() — Line", () => {
      norg(sampleLine);
    });
  });

  test("norg() — Table", () => {
    measure("norg() — Table", () => {
      norg(sampleTable);
    });
  });

  test("toml() — Line", () => {
    measure("toml() — Line", () => {
      toml(sampleLine);
    });
  });

  test("toml() — Table", () => {
    measure("toml() — Table", () => {
      toml(sampleTable);
    });
  });

  test("agent() — Line", () => {
    measure("agent() — Line", () => {
      agent(sampleLine);
    });
  });

  test("agent() — Table", () => {
    measure("agent() — Table", () => {
      agent(sampleTable);
    });
  });

  test("silent() — Line", () => {
    measure("silent() — Line", () => {
      silent(sampleLine);
    });
  });

  test("silent() — Table", () => {
    measure("silent() — Table", () => {
      silent(sampleTable);
    });
  });
});

const validAddress = "session-abc:events";

describe("StreamAddress", () => {
  test("parseAddress() — valid", () => {
    measure("parseAddress() — valid", () => {
      parseAddress(validAddress);
    });
  });

  test("parseAddress() — invalid", () => {
    measure("parseAddress() — invalid", () => {
      parseAddress("no-colon-here");
    });
  });

  test("formatAddress()", () => {
    measure("formatAddress()", () => {
      formatAddress({ owner: "session-abc", name: "events" });
    });
  });

  test("sessionStream()", () => {
    measure("sessionStream()", () => {
      sessionStream("sid-123", "guard-results");
    });
  });
});
