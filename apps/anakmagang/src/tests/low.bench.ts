import { bench, group } from "bun:test";
import { Effect, HashMap, HashSet, Option } from "effect";
import { ulid, isUlid } from "../Ulid";
import * as Yaml from "../Yaml";
import * as Markdown from "../Markdown";
import * as Norg from "../Norg";
import * as Html from "../Html";
import {
  toId,
  parseMemoryFrontmatter,
  serializeNode,
  matchesFilter,
  type MemoryNode,
} from "../MemoryParser";
import { renderStatusline } from "../StatuslineRenderer";
import { Line, Record, Table, emissionChannel } from "../protocol.Emission";
import { matchesTool, hashString } from "../protocol.GuardConfig";
import { sortByBucket } from "../protocol.LatencyBucket";
import { text, json, markdown } from "../protocol.Output";
import { agentFirst } from "../guard.agent-first";
import { agentStopGuard } from "../guard.agent-stop";
import { reflectionRequired } from "../guard.reflection-required";
import { commandSubstitute } from "../guard.command-substitute";
import { extractDescription, resultOf } from "../AuditShared";
import { nodeLabel, renderTree } from "../memory.graph";
import { configToYaml } from "../MachineLoader";
import type { MachineConfig } from "../MachineLoader";
import type { GuardContext, HookInput } from "../protocol.GuardResult";

const yamlFixture = `name: test-project
version: 1
config:
  debug: true
  items:
    - first
    - second
    - third
  nested:
    deep:
      value: 42
      enabled: false`;

const yamlFrontmatterFixture = `---
name: test-memory
description: A test memory node
type: project
scale: finding
state: ACTIVE
updated: "2026-05-20"
session_count: 3
tags:
  - effect
  - guards
---
This is the body content of the memory node.`;

const mdFixture = `# Main Heading

Some introductory paragraph text.

## Section One

- Item one
- Item two
- Item three

## Code Examples

\`\`\`bash
echo "hello world"
nix develop .#anakmagang --command bun test
\`\`\`

\`\`\`typescript
import { Effect } from "effect"
const main = Effect.gen(function* () {
  yield* Effect.log("running")
})
\`\`\`

## Section test

This section has the keyword test in its heading.

| Name | Value | Status |
|------|-------|--------|
| alpha | 1 | pass |
| beta | 2 | fail |

## Final Notes

- Use effect guards
- Check /Users/r17/.config/nixpkgs/ARCHITECTURE.md
- Never expose api_key = "secret123"

Some more text about testing and integration.

1. First ordered item
2. Second ordered item
3. Third ordered item`;

const norgFixture = `@document.meta
title: Test Document
author: r17
@end

* First Heading

Some paragraph text here.

- Item alpha
- Item beta
- Item gamma

@code typescript
const x = 42
const y = Effect.succeed(x)
@end

** Nested Heading

> A quote block
> with multiple lines`;

const htmlFixture = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div class="container">
  <h1>Hello World</h1>
  <div class="content">
    <p>First paragraph</p>
    <p>Second paragraph</p>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </ul>
    <table>
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>alpha</td><td>1</td></tr>
        <tr><td>beta</td><td>2</td></tr>
        <tr><td>gamma</td><td>3</td></tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;

const memoryNode: MemoryNode = {
  id: "test-memory-node",
  name: "Test Memory",
  description: "A test memory for benchmarking",
  type: "project",
  scale: "finding",
  state: "ACTIVE",
  updated: "2026-05-20",
  session_count: 5,
  edges: { derived_from: ["parent-node-1"] },
  tags: ["effect", "guards", "testing"],
  body: "This is the body of a memory node used in benchmarks.",
  source: "permanent",
};

const minimalMachineConfig = {
  name: "bench-machine",
  version: 1,
  ground: {
    stores: [
      {
        kind: "Slot" as const,
        name: "manifest",
        per: "singleton" as const,
        tracks: { current_task: "set" as const },
      },
    ],
  },
  runtime: {
    memory: {
      scales: ["observation", "finding", "learning", "principle"] as const,
      states: ["ACTIVE", "STALE", "ARCHIVED"] as const,
      stale_thresholds: { user: 10, feedback: 3, project: 5, reference: 8 },
      promotion: { min_sources: 3, auto: false },
      graph: { edge_types: ["derived_from"], max_depth: 2, max_fan_out: 5, max_query_nodes: 10 },
    },
  },
  phases: [
    { id: "setup", name: "Setup", exit_question: "What assumptions?", next: "impl" },
    { id: "impl", name: "Implementation", exit_question: "Did it work?", next: "done" },
  ],
};

const guardCtxBase: Omit<GuardContext, "input"> = {
  env: { CLAUDE_PROJECT_DIR: "/Users/r17/.config/nixpkgs" },
  guard: {
    type: "agent-first",
    matcher: "Edit|Write",
    routes: { ".ts": "effect-ts", ".nix": "nix-coder" },
  },
};

const parsedMd = Markdown.parse(mdFixture);
const parsedMdAst = Markdown.parseToAst(mdFixture);
const parsedNorg = Norg.parseToAst(norgFixture);
const parsedHtml = Html.parse(htmlFixture);

const complexYamlValue = Yaml.map([
  { key: "name", value: Yaml.scalar("project") },
  { key: "items", value: Yaml.list([Yaml.scalar("a"), Yaml.scalar("b"), Yaml.scalar("c")]) },
  {
    key: "config",
    value: Yaml.map([
      { key: "debug", value: Yaml.scalar(true) },
      {
        key: "nested",
        value: Yaml.map([
          { key: "values", value: Yaml.list([Yaml.scalar(1), Yaml.scalar(2), Yaml.scalar(3)]) },
        ]),
      },
    ]),
  },
]);

const parsedYaml = Yaml.parse(yamlFixture);
const yamlAst = Yaml.toAst(parsedYaml);

group("Ulid", () => {
  bench("ulid()", () => {
    Effect.runSync(ulid);
  });

  bench("isUlid(value)", () => {
    isUlid("01H5QXYZ0000000000000000AA");
  });
});

group("Yaml", () => {
  bench("Yaml.scalar('hello')", () => {
    Yaml.scalar("hello");
  });

  bench("Yaml.list([scalar, scalar])", () => {
    Yaml.list([Yaml.scalar("a"), Yaml.scalar("b")]);
  });

  bench("Yaml.map([{key, value}])", () => {
    Yaml.map([{ key: "k", value: Yaml.scalar("v") }]);
  });

  bench("Yaml.prettyPrintDoc(complexValue)", () => {
    Yaml.prettyPrintDoc(Yaml.doc(complexYamlValue));
  });

  bench("Yaml.parse(yamlString)", () => {
    Yaml.parse(yamlFixture);
  });

  bench("Yaml.parseFrontmatter(content)", () => {
    Yaml.parseFrontmatter(yamlFrontmatterFixture);
  });

  bench("Yaml.toAst(parsed)", () => {
    Yaml.toAst(parsedYaml);
  });

  bench("Yaml.fromAst(ast)", () => {
    Yaml.fromAst(yamlAst);
  });
});

group("Markdown", () => {
  bench("Markdown.parse(mdContent)", () => {
    Markdown.parse(mdFixture);
  });

  bench("Markdown.findSections(doc, 'test')", () => {
    Markdown.findSections(parsedMd, "test");
  });

  bench("Markdown.codeBlocksByLanguage(doc, 'bash')", () => {
    Markdown.codeBlocksByLanguage(parsedMd, "bash");
  });

  bench("Markdown.containsKeyword(text, keywords)", () => {
    Markdown.containsKeyword(mdFixture, ["effect", "guard"]);
  });

  bench("Markdown.findAbsolutePaths(text)", () => {
    Markdown.findAbsolutePaths(mdFixture);
  });

  bench("Markdown.hasSecretAssignment(text)", () => {
    Markdown.hasSecretAssignment(mdFixture);
  });

  bench("Markdown.parseToAst(mdContent)", () => {
    Markdown.parseToAst(mdFixture);
  });

  bench("Markdown.prettyPrintMdDoc(astDoc)", () => {
    Markdown.prettyPrintMdDoc(parsedMdAst);
  });
});

group("Norg", () => {
  bench("Norg.parseToAst(norgContent)", () => {
    Norg.parseToAst(norgFixture);
  });

  bench("Norg.prettyPrintDoc(norgDoc)", () => {
    Norg.prettyPrintDoc(parsedNorg);
  });

  bench("Norg.fromAst(norgDoc)", () => {
    Norg.fromAst(parsedNorg);
  });
});

group("Html", () => {
  bench("Html.parse(htmlContent)", () => {
    Html.parse(htmlFixture);
  });

  bench("Html.prettyPrintDoc(htmlDoc)", () => {
    Html.prettyPrintDoc(parsedHtml);
  });

  bench("Html.table(headers, rows)", () => {
    Html.table(
      ["Name", "Age", "City"],
      Array.from({ length: 10 }, (_, i) => [`User${i}`, String(20 + i), `City${i}`]),
    );
  });
});

group("MemoryParser", () => {
  bench("toId('Some Complex Name!')", () => {
    toId("Some Complex Name!");
  });

  bench("parseMemoryFrontmatter(content, id)", () => {
    Effect.runSync(parseMemoryFrontmatter(yamlFrontmatterFixture, "test-id"));
  });

  bench("serializeNode(node)", () => {
    serializeNode(memoryNode);
  });

  bench("matchesFilter(node, filter)", () => {
    matchesFilter(memoryNode, { tag: "effect", scale: "finding", state: "ACTIVE" });
  });
});

group("StatuslineRenderer", () => {
  const hookInput: HookInput = {
    tool_name: "Bash",
    tool_input: { command: "git status" },
    context_window: { used_percentage: 42.5 },
  };
  const sessionState = Option.some({
    sessionId: "abc123",
    task: "implement feature",
    phase: "implementation",
  });

  bench("renderStatusline (default, no config)", () => {
    renderStatusline(undefined, hookInput, sessionState, false);
  });

  bench("renderStatusline (with segments config)", () => {
    renderStatusline(
      {
        segments: [
          {
            id: "ctx",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 10,
            thresholds: [50, 90],
          },
          { id: "phase", source: "state.current_phase", format: "phase: {value}" },
        ],
        separator: " | ",
      },
      hookInput,
      sessionState,
      false,
    );
  });
});

group("Protocol", () => {
  bench("emissionChannel(Line)", () => {
    emissionChannel(Line({ text: "hello" }));
  });

  bench("matchesTool('Edit|Write', 'Edit')", () => {
    matchesTool("Edit|Write", "Edit");
  });

  bench("hashString('some-string')", () => {
    hashString("some-string");
  });

  bench("sortByBucket(guards)", () => {
    sortByBucket([
      { type: "post-edit" },
      { type: "agent-first" },
      { type: "iteration-limit" },
      { type: "compaction-gate" },
      { type: "output-location" },
    ]);
  });
});

group("Output Formatters", () => {
  const lineEmission = Line({ text: "hello" });
  const recordEmission = Record({
    fields: [
      ["name", "test"],
      ["status", "pass"],
      ["count", "42"],
    ],
  });
  const tableEmission = Table({
    headers: ["Name", "Value"],
    rows: [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ],
  });

  bench("text(Line)", () => {
    text(lineEmission);
  });

  bench("json(Record)", () => {
    json(recordEmission);
  });

  bench("markdown(Table)", () => {
    markdown(tableEmission);
  });
});

group("MachineLoader Pure", () => {
  bench("configToYaml(config)", () => {
    configToYaml(minimalMachineConfig as typeof MachineConfig.Type);
  });
});

group("Guards (Pure)", () => {
  bench("agentFirst (no agent_id, tool=Edit)", () => {
    Effect.runSync(
      agentFirst({
        input: {
          tool_name: "Edit",
          tool_input: { file_path: "/Users/r17/.config/nixpkgs/src/foo.ts" },
        },
        ...guardCtxBase,
      } as GuardContext) as Effect.Effect<unknown, never, never>,
    );
  });

  bench("agentStopGuard (output with promise)", () => {
    Effect.runSync(
      agentStopGuard({
        input: {
          output:
            "Files modified: src/foo.ts\nVerification: typecheck pass\n\nIMPLEMENTATION_COMPLETE",
        },
        env: guardCtxBase.env,
        guard: {
          type: "agent-stop-guard",
          promises: ["IMPLEMENTATION_COMPLETE", "VERIFICATION_PASSED"],
        },
      } as GuardContext) as Effect.Effect<unknown, never, never>,
    );
  });

  bench("reflectionRequired (valid reflection)", () => {
    Effect.runSync(
      reflectionRequired({
        input: {
          tool_name: "Bash",
          tool_input: {
            command:
              "anakmagang eval 'I explored broadly and found three modules affected by this change'",
          },
        },
        env: guardCtxBase.env,
        guard: { type: "reflection-required" },
      } as GuardContext) as Effect.Effect<unknown, never, never>,
    );
  });

  bench("commandSubstitute (matching rule)", () => {
    Effect.runSync(
      commandSubstitute({
        input: {
          tool_name: "Bash",
          tool_input: { command: "nix-instantiate --eval ./default.nix" },
        },
        env: guardCtxBase.env,
        guard: {
          type: "command-substitute",
          rules: [
            {
              contains: ["nix-instantiate"],
              should: "Use nix eval instead",
              unless_contains: undefined,
            },
          ],
        },
      } as GuardContext) as Effect.Effect<unknown, never, never>,
    );
  });
});

group("AuditCheck", () => {
  bench("extractDescription(content)", () => {
    extractDescription("# My Feature\n\nSome description text\n\n## Details\n\nMore info here");
  });

  bench("resultOf('structure', 'test-check', 'pass', 'ok')", () => {
    resultOf(1, "test-check", "pass", "ok");
  });
});

group("memory.graph", () => {
  const nodes: ReadonlyArray<MemoryNode> = [
    { ...memoryNode, id: "root", name: "Root", edges: { derived_from: [] } },
    { ...memoryNode, id: "child-1", name: "Child 1", edges: { derived_from: ["root"] } },
    { ...memoryNode, id: "child-2", name: "Child 2", edges: { derived_from: ["root"] } },
    {
      ...memoryNode,
      id: "grandchild-1",
      name: "Grandchild 1",
      edges: { derived_from: ["child-1"] },
    },
    { ...memoryNode, id: "leaf", name: "Leaf", edges: { derived_from: ["grandchild-1"] } },
  ];

  const nodeMap = HashMap.fromIterable(nodes.map((n) => [n.id, n] as const));
  const childrenMap = HashMap.fromIterable<string, ReadonlyArray<string>>([
    ["root", ["child-1", "child-2"]],
    ["child-1", ["grandchild-1"]],
    ["grandchild-1", ["leaf"]],
  ]);

  bench("nodeLabel(node)", () => {
    nodeLabel(memoryNode);
  });

  bench("renderTree(nodes, rootId)", () => {
    renderTree("root", childrenMap, nodeMap, HashSet.empty(), "", true);
  });
});
