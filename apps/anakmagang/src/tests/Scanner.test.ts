import { describe, test, expect, afterEach } from "bun:test";
import { Effect } from "effect";
import { BunServices } from "@effect/platform-bun";
import type { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import { scanDocuments } from "../Scanner";
import * as fs from "node:fs";
import * as nodePath from "node:path";
import * as os from "node:os";

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem | Path>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)));

const tmpDirs: Array<string> = [];

const makeTmpDir = (): string => {
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "scanner-test-"));
  tmpDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

const referenceDoc = () => ({
  name: "reference",
  path: "REFERENCE.md",
  role: "reference" as const,
});

const conventionsDoc = () => ({
  name: "conventions",
  path: "CONVENTIONS.md",
  role: "conventions" as const,
});

describe("scanDocuments", () => {
  test("reference role contains toolchain instructions", async () => {
    const tmpDir = makeTmpDir();
    fs.writeFileSync(nodePath.join(tmpDir, "package.json"), JSON.stringify({ name: "ref" }));
    fs.mkdirSync(nodePath.join(tmpDir, "tests"));
    const result = await run(scanDocuments([referenceDoc()], tmpDir));
    expect(result[0].instructions).toContain("toolchain");
    expect(result[0].instructions).toContain("build tools");
  });

  test("conventions role contains conventions instructions", async () => {
    const tmpDir = makeTmpDir();
    fs.writeFileSync(nodePath.join(tmpDir, "tsconfig.json"), "{}");
    const result = await run(scanDocuments([conventionsDoc()], tmpDir));
    expect(result[0].instructions).toContain("conventions");
    expect(result[0].instructions).toContain("naming");
    expect(result[0].instructions).toContain("TypeScript");
  });

  test("unknown role includes role name and analyze", async () => {
    const tmpDir = makeTmpDir();
    fs.writeFileSync(nodePath.join(tmpDir, "package.json"), JSON.stringify({ name: "x" }));
    const result = await run(
      scanDocuments([{ name: "mystery", path: "MYSTERY.md", role: "unknown-role" }], tmpDir),
    );
    expect(result[0].instructions).toContain("unknown-role");
    expect(result[0].instructions).toContain("Analyze");
    expect(result[0].role).toBe("unknown-role");
  });

  test("multiple documents each get instructions", async () => {
    const tmpDir = makeTmpDir();
    fs.writeFileSync(nodePath.join(tmpDir, "package.json"), JSON.stringify({ name: "multi" }));
    fs.mkdirSync(nodePath.join(tmpDir, "tests"));
    const docs = [referenceDoc(), conventionsDoc()];
    const result = await run(scanDocuments(docs, tmpDir));
    expect(result.length).toBe(2);
    expect(result[0].path).toBe("REFERENCE.md");
    expect(result[0].instructions.length).toBeGreaterThan(0);
    expect(result[1].path).toBe("CONVENTIONS.md");
    expect(result[1].instructions.length).toBeGreaterThan(0);
  });

  test("reference role with no signals includes no signals message", async () => {
    const tmpDir = makeTmpDir();
    const result = await run(scanDocuments([referenceDoc()], tmpDir));
    expect(result[0].instructions).toContain("no project signals detected");
  });

  test("conventions role with no signals includes no signals message", async () => {
    const tmpDir = makeTmpDir();
    const result = await run(scanDocuments([conventionsDoc()], tmpDir));
    expect(result[0].instructions).toContain("no project signals detected");
  });
});
