import { describe, test } from "bun:test";
import {
  codeBlock,
  codeBlocksByLanguage,
  containsKeyword,
  findAbsolutePaths,
  findFileReferences,
  findSections,
  fromAst,
  hasHeadingAtLevel,
  hasListItems,
  hasMultiLineCodeBlocks,
  hasSecretAssignment,
  hasSection,
  heading,
  isAbsolutePath,
  isValidSkillName,
  list,
  mdDoc,
  paragraph,
  parse,
  parseToAst,
  prettyPrintMdDoc,
  sectionHeaders,
  shellCodeBlocks,
  table,
} from "../../../Markdown";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const fixture = `# Project Overview

This is a sample project with multiple components.

## Installation

Follow these steps to get started:

- Clone the repository
- Install dependencies
- Configure environment

\`\`\`bash
git clone https://github.com/example/repo.git
cd repo
npm install
\`\`\`

## Configuration

Set up your environment variables:

\`\`\`typescript
import { Config } from "effect"

const config = Config.all({
  port: Config.number("PORT"),
  host: Config.string("HOST"),
  debug: Config.boolean("DEBUG"),
})
\`\`\`

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List all users |
| POST | /api/users | Create a user |
| DELETE | /api/users/:id | Remove a user |

### Authentication

All requests require a bearer token. See \`/Users/r17/.config/auth.json\` for details.

1. Generate a token
2. Add to request headers
3. Verify response status

## Development

Run the dev server:

\`\`\`sh
export API_KEY="sk-test-12345"
bun run dev
\`\`\`

File references: \`/home/user/projects/app/src/index.ts\`
`;

const doc = parse(fixture);

const sampleDoc = mdDoc(
  heading(1, "Title"),
  paragraph("Some introductory text."),
  list(["first", "second", "third"], false),
  codeBlock("typescript", "const x = 42"),
  table(
    ["Name", "Value"],
    [
      ["alpha", "1"],
      ["beta", "2"],
    ],
  ),
);

describe("Markdown — parsing", () => {
  test("parse() — 50 line document", () => {
    measure("parse() — 50 line document", () => {
      parse(fixture);
    });
  });

  test("parseToAst() — 50 line document", () => {
    measure("parseToAst() — 50 line document", () => {
      parseToAst(fixture);
    });
  });
});

describe("Markdown — querying", () => {
  test("findSections() — existing section", () => {
    measure("findSections() — existing section", () => {
      findSections(doc, "Installation");
    });
  });

  test("hasSection() — existing section", () => {
    measure("hasSection() — existing section", () => {
      hasSection(doc, "Configuration");
    });
  });

  test("hasSection() — missing section", () => {
    measure("hasSection() — missing section", () => {
      hasSection(doc, "Nonexistent");
    });
  });

  test("codeBlocksByLanguage() — typescript", () => {
    measure("codeBlocksByLanguage() — typescript", () => {
      codeBlocksByLanguage(doc, "typescript");
    });
  });

  test("shellCodeBlocks()", () => {
    measure("shellCodeBlocks()", () => {
      shellCodeBlocks(doc);
    });
  });

  test("hasMultiLineCodeBlocks()", () => {
    measure("hasMultiLineCodeBlocks()", () => {
      hasMultiLineCodeBlocks(doc);
    });
  });

  test("hasHeadingAtLevel() — level 2", () => {
    measure("hasHeadingAtLevel() — level 2", () => {
      hasHeadingAtLevel(doc, 2);
    });
  });

  test("sectionHeaders()", () => {
    measure("sectionHeaders()", () => {
      sectionHeaders(doc);
    });
  });

  test("hasListItems()", () => {
    measure("hasListItems()", () => {
      hasListItems(doc);
    });
  });

  test("containsKeyword() — match", () => {
    measure("containsKeyword() — match", () => {
      containsKeyword(fixture, ["configuration", "development"]);
    });
  });

  test("containsKeyword() — no match", () => {
    measure("containsKeyword() — no match", () => {
      containsKeyword(fixture, ["nonexistent", "missing"]);
    });
  });

  test("isAbsolutePath() — valid", () => {
    measure("isAbsolutePath() — valid", () => {
      isAbsolutePath("/Users/r17/.config/auth.json");
    });
  });

  test("isAbsolutePath() — invalid", () => {
    measure("isAbsolutePath() — invalid", () => {
      isAbsolutePath("relative/path.ts");
    });
  });

  test("findAbsolutePaths()", () => {
    measure("findAbsolutePaths()", () => {
      findAbsolutePaths(fixture);
    });
  });

  test("findFileReferences()", () => {
    measure("findFileReferences()", () => {
      findFileReferences(fixture, "/home/", ".ts");
    });
  });

  test("isValidSkillName() — valid", () => {
    measure("isValidSkillName() — valid", () => {
      isValidSkillName("my-skill-name");
    });
  });

  test("isValidSkillName() — invalid", () => {
    measure("isValidSkillName() — invalid", () => {
      isValidSkillName("Invalid Name!");
    });
  });

  test("hasSecretAssignment() — present", () => {
    measure("hasSecretAssignment() — present", () => {
      hasSecretAssignment('export API_KEY="sk-test-12345"');
    });
  });

  test("hasSecretAssignment() — absent", () => {
    measure("hasSecretAssignment() — absent", () => {
      hasSecretAssignment("const x = 42");
    });
  });
});

describe("Markdown — AST construction", () => {
  test("heading()", () => {
    measure("heading()", () => {
      heading(2, "Section Title");
    });
  });

  test("paragraph()", () => {
    measure("paragraph()", () => {
      paragraph("A paragraph of descriptive text.");
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
      codeBlock("typescript", "const x: number = 42\nconst y = x + 1");
    });
  });

  test("table()", () => {
    measure("table()", () => {
      table(
        ["Col A", "Col B", "Col C"],
        [
          ["1", "2", "3"],
          ["4", "5", "6"],
        ],
      );
    });
  });

  test("mdDoc() — composite document", () => {
    measure("mdDoc() — composite document", () => {
      mdDoc(
        heading(1, "Doc"),
        paragraph("Intro"),
        list(["a", "b"], false),
        codeBlock("ts", "x"),
        table(["H"], [["R"]]),
      );
    });
  });
});

describe("Markdown — rendering", () => {
  test("prettyPrintMdDoc() — composite document", () => {
    measure("prettyPrintMdDoc() — composite document", () => {
      prettyPrintMdDoc(sampleDoc);
    });
  });

  test("fromAst() — composite document", () => {
    measure("fromAst() — composite document", () => {
      fromAst(sampleDoc);
    });
  });

  test("fromAst(parseToAst()) — roundtrip", () => {
    measure("fromAst(parseToAst()) — roundtrip", () => {
      fromAst(parseToAst(fixture));
    });
  });
});
