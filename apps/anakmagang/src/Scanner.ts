import { Array as Arr, Effect, Option } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";

interface ProjectSignal {
  readonly kind: string;
  readonly path: string;
  readonly detail: string;
}

interface DocumentInfo {
  readonly name: string;
  readonly path: string;
  readonly role: string;
}

export interface ScanInstruction {
  readonly path: string;
  readonly name: string;
  readonly role: string;
  readonly instructions: string;
}

const SIGNAL_CHECKS: ReadonlyArray<{
  readonly path: string;
  readonly kind: string;
  readonly detail: (content: string | undefined) => string;
  readonly readContent?: boolean;
}> = [
  {
    path: "package.json",
    kind: "package-manager",
    detail: () => "Node.js project (package.json)",
    readContent: true,
  },
  { path: "flake.nix", kind: "nix", detail: () => "Nix flake project" },
  { path: "Makefile", kind: "build-tool", detail: () => "Make build system" },
  { path: "justfile", kind: "build-tool", detail: () => "Just command runner" },
  { path: "tsconfig.json", kind: "language", detail: () => "TypeScript project" },
  { path: "Cargo.toml", kind: "language", detail: () => "Rust project (Cargo)" },
  { path: "go.mod", kind: "language", detail: () => "Go module" },
  { path: "stack.yaml", kind: "language", detail: () => "Haskell project (Stack)" },
  { path: "Gemfile", kind: "language", detail: () => "Ruby project (Bundler)" },
  { path: "requirements.txt", kind: "language", detail: () => "Python project (pip)" },
  { path: "pyproject.toml", kind: "language", detail: () => "Python project (pyproject)" },
];

const DIR_CHECKS: ReadonlyArray<{
  readonly path: string;
  readonly kind: string;
  readonly detail: string;
}> = [
  { path: "src", kind: "source-dir", detail: "Source directory (src/)" },
  { path: "lib", kind: "source-dir", detail: "Library directory (lib/)" },
  { path: "test", kind: "test-dir", detail: "Test directory (test/)" },
  { path: "tests", kind: "test-dir", detail: "Test directory (tests/)" },
  { path: ".github/workflows", kind: "ci", detail: "GitHub Actions CI" },
];

const checkFileSignal = (
  fs: FileSystem,
  targetDir: string,
  p: Path,
  check: (typeof SIGNAL_CHECKS)[number],
): Effect.Effect<ReadonlyArray<ProjectSignal>> =>
  Effect.gen(function* () {
    const fullPath = p.join(targetDir, check.path);
    const exists = yield* fs.exists(fullPath).pipe(Effect.orElseSucceed(() => false));
    if (!exists) return Arr.empty<ProjectSignal>();
    if (check.readContent) {
      const content = yield* fs.readFileString(fullPath).pipe(Effect.orElseSucceed(() => ""));
      return [{ kind: check.kind, path: check.path, detail: check.detail(content) }];
    }
    return [{ kind: check.kind, path: check.path, detail: check.detail(undefined) }];
  });

const checkDirSignal = (
  fs: FileSystem,
  targetDir: string,
  p: Path,
  check: (typeof DIR_CHECKS)[number],
): Effect.Effect<ReadonlyArray<ProjectSignal>> =>
  Effect.gen(function* () {
    const fullPath = p.join(targetDir, check.path);
    const exists = yield* fs.exists(fullPath).pipe(Effect.orElseSucceed(() => false));
    if (!exists) return Arr.empty<ProjectSignal>();
    const stat = yield* fs.stat(fullPath).pipe(Effect.option);
    if (Option.isNone(stat) || stat.value.type !== "Directory") return Arr.empty<ProjectSignal>();
    return [{ kind: check.kind, path: check.path, detail: check.detail }];
  });

const checkCabalSignal = (
  fs: FileSystem,
  targetDir: string,
): Effect.Effect<ReadonlyArray<ProjectSignal>> =>
  Effect.gen(function* () {
    const entries = yield* fs
      .readDirectory(targetDir)
      .pipe(Effect.orElseSucceed(() => Arr.empty<string>()));
    const cabalFiles = Arr.filter(entries, (e) => e.endsWith(".cabal"));
    if (cabalFiles.length === 0) return Arr.empty<ProjectSignal>();
    return [{ kind: "language", path: cabalFiles[0] ?? "", detail: "Haskell project (Cabal)" }];
  });

const scanProject = Effect.fn("Scanner.scanProject")(function* (targetDir: string) {
  const fs = yield* FileSystem;
  const p = yield* Path;

  const fileSignals = yield* Effect.forEach(SIGNAL_CHECKS, (check) =>
    checkFileSignal(fs, targetDir, p, check),
  );
  const dirSignals = yield* Effect.forEach(DIR_CHECKS, (check) =>
    checkDirSignal(fs, targetDir, p, check),
  );
  const cabalSignals = yield* checkCabalSignal(fs, targetDir);

  return [...Arr.flatten(fileSignals), ...Arr.flatten(dirSignals), ...cabalSignals];
});

const formatSignalsList = (signals: ReadonlyArray<ProjectSignal>): string =>
  Arr.match(signals, {
    onEmpty: () => "- (no project signals detected — analyze the directory manually)",
    onNonEmpty: (ss) => Arr.map(ss, (s) => `- ${s.detail}`).join("\n"),
  });

const generateInstructions = (doc: DocumentInfo, signals: ReadonlyArray<ProjectSignal>): string => {
  const signalsList = formatSignalsList(signals);

  switch (doc.role) {
    case "reference":
      return [
        "Analyze this project and document its toolchain:",
        "",
        "1. Identify build tools and their commands",
        "2. Find test frameworks and how to run tests",
        "3. Locate CI/CD pipelines and their steps",
        "4. Document deployment or release processes",
        "",
        "Detected signals:",
        signalsList,
        "",
        `Write the result to: ${doc.path}`,
      ].join("\n");

    case "conventions":
      return [
        "Analyze this project's code conventions:",
        "",
        "1. Identify programming languages and their versions",
        "2. Document naming conventions (files, functions, variables)",
        "3. Describe test organization (co-located vs separate)",
        "4. Note import/module patterns",
        "5. List linting/formatting tools",
        "",
        "Detected signals:",
        signalsList,
        "",
        `Write the result to: ${doc.path}`,
      ].join("\n");

    default:
      return [
        `Analyze this project and document it for the "${doc.role}" perspective:`,
        "",
        "Detected signals:",
        signalsList,
        "",
        `Write the result to: ${doc.path}`,
      ].join("\n");
  }
};

export const scanDocuments = Effect.fn("Scanner.scanDocuments")(function* (
  docs: ReadonlyArray<DocumentInfo>,
  targetDir: string,
) {
  const signals = yield* scanProject(targetDir);
  return Arr.map(
    docs,
    (doc): ScanInstruction => ({
      path: doc.path,
      name: doc.name,
      role: doc.role,
      instructions: generateInstructions(doc, signals),
    }),
  );
});
