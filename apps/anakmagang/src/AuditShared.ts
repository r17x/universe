import { Array as Arr, type Context, Effect, Layer, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import type { AuditReport, AuditResult, FixResult } from "./AgentAuditor";
import { AuditError, formatFixResult, formatReport, makeSummary } from "./AgentAuditor";
import { runChecks, skipAll, type AuditCheck, type CheckContext } from "./AuditCheck";
import * as Markdown from "./Markdown";
import * as Yaml from "./Yaml";

export const resultOf = (
  phase: number,
  check: string,
  status: AuditResult["status"],
  message: string,
): AuditResult => ({
  phase,
  check,
  status,
  message,
});

export const extractDescription = (content: string): string => {
  const doc = Markdown.parse(content);
  return Arr.head(doc.headings).pipe(
    Option.map((h) => h.text.slice(0, 100)),
    Option.getOrElse(() => {
      const firstNonEmpty = content.split("\n").find((l) => l.trim().length > 0);
      return firstNonEmpty ? firstNonEmpty.trim().slice(0, 100) : "No description";
    }),
  );
};

export const collectSkipped = (report: AuditReport, frontmatterCheck: string): readonly string[] =>
  Arr.map(
    Arr.filter(
      Arr.filter(report.results, (r) => r.status === "warn" || r.status === "fail"),
      (r) => r.check !== frontmatterCheck,
    ),
    (r) => `${r.check}: ${r.message}`,
  );

export const fixOne = (
  auditFn: (filePath: string) => Effect.Effect<AuditReport, AuditError>,
  frontmatterCheck: string,
) =>
  Effect.fn("AuditShared.fixOne")(function* (filePath: string) {
    const fs = yield* FileSystem;
    const p = yield* Path;
    const content = yield* fs
      .readFileString(filePath)
      .pipe(
        Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot read file" })),
      );
    const parsed = Yaml.parseFrontmatter(content);
    const report = yield* auditFn(filePath);

    if (parsed === null) {
      const basename = p.basename(filePath).replace(/\.md$/, "");
      const description = extractDescription(content);
      const fixedContent = Yaml.serializeFrontmatter(
        [
          { key: "name", value: Yaml.scalar(basename) },
          { key: "description", value: Yaml.scalar(description) },
          { key: "updated", value: Yaml.scalar("2026-05-10") },
        ],
        "\n" + content,
      );
      yield* fs
        .writeFileString(filePath, fixedContent)
        .pipe(
          Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot write file" })),
        );
      const postReport = yield* auditFn(filePath);
      const skipped = collectSkipped(postReport, frontmatterCheck);
      return {
        target: filePath,
        fixes: ["Added frontmatter (name, description, updated)"],
        skipped,
      } satisfies FixResult;
    }

    const fm: Record<string, unknown> = parsed.fm;
    const hasMissingName =
      !("name" in fm) || typeof fm["name"] !== "string" || fm["name"].length === 0;
    const hasMissingDesc =
      !("description" in fm) ||
      typeof fm["description"] !== "string" ||
      fm["description"].length === 0;
    const hasMissingDate = !("updated" in fm) && !("created" in fm);

    const basename = p.basename(filePath).replace(/\.md$/, "");
    const description = extractDescription(parsed.body);

    const additions = [
      ...(hasMissingName ? [`name: ${Yaml.quoteYaml(basename)}`] : []),
      ...(hasMissingDesc ? [`description: ${Yaml.quoteYaml(description)}`] : []),
      ...(hasMissingDate ? [`updated: "2026-05-10"`] : []),
    ];
    const fixes = [
      ...(hasMissingName ? ["Added missing name field"] : []),
      ...(hasMissingDesc ? ["Added missing description field"] : []),
      ...(hasMissingDate ? ["Added missing updated date"] : []),
    ];

    if (fixes.length === 0) {
      const skipped = collectSkipped(report, frontmatterCheck);
      return { target: filePath, fixes: [], skipped } satisfies FixResult;
    }

    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    const existingFm = fmMatch ? (fmMatch[1] ?? "") : "";
    const newFm = Arr.filter([existingFm, ...additions], (s) => s.length > 0).join("\n");
    const bodyStart = fmMatch ? content.slice(fmMatch[0].length) : content;
    const fixedContent = `---\n${newFm}\n---\n${bodyStart}`;
    yield* fs
      .writeFileString(filePath, fixedContent)
      .pipe(
        Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot write file" })),
      );
    const postReport = yield* auditFn(filePath);
    const skipped = collectSkipped(postReport, frontmatterCheck);
    return { target: filePath, fixes, skipped } satisfies FixResult;
  });

export const scanDir = (dirSegments: readonly string[]) => ({
  auditAll: <E, R>(
    auditFn: (filePath: string) => Effect.Effect<AuditReport, E, R>,
    concurrency: "unbounded" | number,
  ) =>
    Effect.fn("AuditShared.scanDir.auditAll")(function* () {
      const fs = yield* FileSystem;
      const p = yield* Path;
      const dir = p.resolve(...dirSegments);
      const exists = yield* fs.exists(dir).pipe(Effect.orElseSucceed(() => false));
      if (!exists) {
        const empty: readonly AuditReport[] = [];
        return empty;
      }
      const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => [] as string[]));
      const mdFiles = Arr.filter(entries, (e) => e.endsWith(".md"));
      return yield* Effect.forEach(mdFiles, (file) => auditFn(p.join(dir, file)), { concurrency });
    }),
  fixAll: <E, R>(fixFn: (filePath: string) => Effect.Effect<FixResult, E, R>) =>
    Effect.fn("AuditShared.scanDir.fixAll")(function* () {
      const fs = yield* FileSystem;
      const p = yield* Path;
      const dir = p.resolve(...dirSegments);
      const exists = yield* fs.exists(dir).pipe(Effect.orElseSucceed(() => false));
      if (!exists) {
        const empty: readonly FixResult[] = [];
        return empty;
      }
      const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => [] as string[]));
      const mdFiles = Arr.filter(entries, (e) => e.endsWith(".md"));
      return yield* Effect.forEach(mdFiles, (file) => fixFn(p.join(dir, file)), { concurrency: 1 });
    }),
});

export const makeAuditor = (config: {
  readonly type: "agent" | "skill";
  readonly dirSegments: readonly string[];
  readonly frontmatterCheckName: string;
  readonly checks: readonly AuditCheck[];
  readonly validateFrontmatter: (
    parsed: { fm: Record<string, unknown>; body: string } | null,
  ) => AuditResult;
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const p = yield* Path;

    const auditOne = Effect.fn(`${config.type}Auditor.audit`)(function* (filePath: string) {
      const content = yield* fs
        .readFileString(filePath)
        .pipe(
          Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot read file" })),
        );
      const lines = content.split("\n");
      const parsed = Yaml.parseFrontmatter(content);
      const frontmatterResult = config.validateFrontmatter(parsed);

      if (frontmatterResult.status === "fail") {
        const results: readonly AuditResult[] = [frontmatterResult, ...skipAll(config.checks)];
        return { target: filePath, type: config.type, results, summary: makeSummary(results) };
      }

      const fm: Record<string, unknown> = parsed?.fm ?? {};
      const body = parsed?.body ?? "";
      const doc = Markdown.parse(body);
      const lowerBody = body.toLowerCase();

      const ctx: CheckContext = { body, lowerBody, doc, fm, content, filePath, lines };
      const checkResults = yield* runChecks(config.checks, ctx);
      const results: readonly AuditResult[] = [frontmatterResult, ...checkResults];
      return { target: filePath, type: config.type, results, summary: makeSummary(results) };
    });

    const dir = scanDir(config.dirSegments);
    const doFix = fixOne(auditOne, config.frontmatterCheckName);
    const fspLayer = Layer.mergeAll(Layer.succeed(FileSystem, fs), Layer.succeed(Path, p));

    return {
      audit: auditOne,
      auditAll: () => dir.auditAll(auditOne, "unbounded")().pipe(Effect.provide(fspLayer)),
      fix: (filePath: string) => doFix(filePath).pipe(Effect.provide(fspLayer)),
      fixAll: () => dir.fixAll(doFix)().pipe(Effect.provide(fspLayer)),
    };
  });

export interface AuditorContract {
  readonly audit: (filePath: string) => Effect.Effect<AuditReport, AuditError>;
  readonly auditAll: () => Effect.Effect<readonly AuditReport[], AuditError>;
  readonly fix: (filePath: string) => Effect.Effect<FixResult, AuditError>;
  readonly fixAll: () => Effect.Effect<readonly FixResult[], AuditError>;
}

export const makeAuditCommand = <I, LE>(config: {
  readonly name: string;
  readonly dirPrefix: string;
  readonly auditorTag: Context.Service<I, AuditorContract>;
  readonly layer: Layer.Layer<I, LE, FileSystem | Path>;
}) =>
  Command.make(
    config.name,
    {
      name: Argument.string("name").pipe(
        Argument.withSchema(Schema.NonEmptyString),
        Argument.optional,
      ),
      fix: Flag.boolean("fix").pipe(Flag.withDefault(false)),
    },
    ({ name, fix }) =>
      Effect.gen(function* () {
        const auditor: AuditorContract = yield* config.auditorTag;
        if (fix) {
          const results = Option.isSome(name)
            ? [yield* auditor.fix(`${config.dirPrefix}/${name.value}.md`)]
            : yield* auditor.fixAll();
          yield* Effect.forEach(results, (result) => formatFixResult(result));
          return;
        }
        const reports = Option.isSome(name)
          ? [yield* auditor.audit(`${config.dirPrefix}/${name.value}.md`)]
          : yield* auditor.auditAll();
        yield* Effect.forEach(reports, (report) => formatReport(report));
      }).pipe(Effect.provide(config.layer)),
  );
