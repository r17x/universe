import { Array as Arr, Effect, Option } from "effect";
import type { FileSystem as FileSystemType } from "effect/FileSystem";
import type { Path as PathType } from "effect/Path";
import type { AuditCheck, CheckContext } from "./AuditCheck";
import { pureCheck } from "./AuditCheck";
import { resultOf } from "./AuditShared";
import * as Markdown from "./Markdown";

const hasName: AuditCheck = pureCheck(2, "has-name", (ctx) => {
  const has = "name" in ctx.fm && typeof ctx.fm["name"] === "string" && ctx.fm["name"].length > 0;
  return has
    ? resultOf(2, "has-name", "pass", `Name: ${ctx.fm["name"]}`)
    : resultOf(2, "has-name", "fail", "Missing name field in frontmatter");
});

const hasDescription: AuditCheck = pureCheck(3, "has-description", (ctx) => {
  const has =
    "description" in ctx.fm &&
    typeof ctx.fm["description"] === "string" &&
    ctx.fm["description"].length > 0;
  return has
    ? resultOf(3, "has-description", "pass", "Description present")
    : resultOf(3, "has-description", "fail", "Missing description field in frontmatter");
});

const sizeCheck: AuditCheck = pureCheck(4, "size-check", (ctx) => {
  const lineCount = ctx.lines.length;
  return lineCount <= 500
    ? resultOf(4, "size-check", "pass", `${lineCount} lines`)
    : lineCount <= 800
      ? resultOf(4, "size-check", "warn", `${lineCount} lines (>500, consider trimming)`)
      : resultOf(4, "size-check", "fail", `${lineCount} lines (>800, too large)`);
});

const location: AuditCheck = pureCheck(5, "location", (ctx) => {
  const inSkillsDir = ctx.filePath.includes(".claude/skills/");
  return inSkillsDir
    ? resultOf(5, "location", "pass", "Located in .claude/skills/")
    : resultOf(5, "location", "warn", "Not in .claude/skills/ directory");
});

const purposeStatement: AuditCheck = pureCheck(6, "purpose-statement", (ctx) => {
  const firstParagraph = ctx.body.trim().split("\n\n")[0] || "";
  return firstParagraph.length > 20
    ? resultOf(6, "purpose-statement", "pass", "Clear purpose statement found")
    : resultOf(6, "purpose-statement", "warn", "First paragraph too short or missing");
});

const actionableContent: AuditCheck = pureCheck(7, "actionable-content", (ctx) => {
  const hasCodeBlockMarker = ctx.doc.codeBlocks.length > 0;
  const hasSteps = Markdown.hasListItems(ctx.doc);
  return hasCodeBlockMarker || hasSteps
    ? resultOf(7, "actionable-content", "pass", "Actionable content found")
    : resultOf(7, "actionable-content", "warn", "No steps or code blocks found");
});

const hasExamples: AuditCheck = pureCheck(8, "has-examples", (ctx) => {
  const hasMultiLineCodeBlock = Markdown.hasMultiLineCodeBlocks(ctx.doc);
  return hasMultiLineCodeBlock
    ? resultOf(8, "has-examples", "pass", "Code examples found")
    : resultOf(8, "has-examples", "warn", "No multi-line code examples found");
});

const hasConstraints: AuditCheck = pureCheck(9, "has-constraints", (ctx) => {
  const hasConstraintLang = Markdown.containsKeyword(ctx.body, [
    "don't",
    "must not",
    "never",
    "do not",
    "limit",
    "constraint",
  ]);
  return hasConstraintLang
    ? resultOf(9, "has-constraints", "pass", "Constraints defined")
    : resultOf(9, "has-constraints", "warn", "No constraint language found");
});

const consistentVoice: AuditCheck = pureCheck(10, "consistent-voice", (ctx) => {
  const hasPassive = Markdown.containsKeyword(ctx.body, ["you should", "you can", "you need"]);
  const hasImperative = ctx.body.split("\n").some((l) => {
    const trimmed = l.trim();
    if (trimmed.length < 3) return false;
    const firstChar = trimmed[0] ?? "";
    return (
      firstChar >= "A" &&
      firstChar <= "Z" &&
      (trimmed[1] ?? "") >= "a" &&
      (trimmed[1] ?? "") <= "z" &&
      trimmed.includes(" ")
    );
  });
  return hasPassive && hasImperative
    ? resultOf(10, "consistent-voice", "warn", "Mixed passive and imperative voice detected")
    : resultOf(10, "consistent-voice", "pass", "Consistent voice");
});

const sectionStructure: AuditCheck = pureCheck(11, "section-structure", (ctx) => {
  const headers = Markdown.sectionHeaders(ctx.doc);
  return headers.length > 0
    ? resultOf(11, "section-structure", "pass", `${headers.length} section header(s) found`)
    : resultOf(11, "section-structure", "warn", "No ## headers found");
});

const noPlaceholder: AuditCheck = pureCheck(12, "no-placeholder", (ctx) => {
  const placeholderWords = ["TODO", "FIXME", "TBD", "XXX", "HACK"] as const;
  const hasPlaceholderText = placeholderWords.some((w) => ctx.body.includes(w));
  return hasPlaceholderText
    ? resultOf(12, "no-placeholder", "fail", "Placeholder text found in body")
    : resultOf(12, "no-placeholder", "pass", "No placeholder text");
});

const gatewayCompatible: AuditCheck = pureCheck(13, "gateway-compatible", (ctx) => {
  const mentionsNixDomain = Markdown.containsKeyword(ctx.body, ["nix", "darwin"]);
  const hasWhenToUse =
    Markdown.containsKeyword(ctx.body, ["when to use"]) ||
    Markdown.hasSection(ctx.doc, "when") ||
    Markdown.hasSection(ctx.doc, "trigger");
  return mentionsNixDomain && !hasWhenToUse
    ? resultOf(
        13,
        "gateway-compatible",
        "warn",
        "Mentions nix/darwin but missing 'When to use' section",
      )
    : resultOf(13, "gateway-compatible", "pass", "Gateway compatible");
});

const agentBoundarySafe: AuditCheck = pureCheck(14, "agent-boundary-safe", (ctx) => {
  const mentionsEditWrite = Markdown.containsKeyword(ctx.body, ["edit tool", "write tool"]);
  const mentionsCoordinator = Markdown.containsKeyword(ctx.body, ["coordinator"]);
  return mentionsEditWrite && mentionsCoordinator
    ? resultOf(
        14,
        "agent-boundary-safe",
        "warn",
        "References Edit/Write tool and coordinator — potential boundary violation",
      )
    : resultOf(14, "agent-boundary-safe", "pass", "Agent boundary safe");
});

const makeDependencyCheck = (fs: FileSystemType, p: PathType): AuditCheck => ({
  phase: 15,
  name: "dependency-exists",
  run: (ctx: CheckContext) => {
    const skillPathRefs = Markdown.findFileReferences(ctx.body, ".claude/skills/", ".md");
    return Effect.forEach(skillPathRefs, (ref) =>
      fs.exists(p.resolve(ref)).pipe(
        Effect.orElseSucceed(() => false),
        Effect.map((exists) => (exists ? null : ref)),
      ),
    ).pipe(
      Effect.map((refs) => Arr.filter(refs, (r): r is string => r !== null)),
      Effect.map((missingRefs) =>
        missingRefs.length > 0
          ? resultOf(
              15,
              "dependency-exists",
              "fail",
              `Referenced skill not found: ${Arr.head(missingRefs).pipe(Option.getOrElse(() => "unknown"))}`,
            )
          : resultOf(
              15,
              "dependency-exists",
              "pass",
              skillPathRefs.length > 0
                ? `All ${skillPathRefs.length} skill reference(s) exist`
                : "No skill references to check",
            ),
      ),
    );
  },
});

const crossReferencesValid: AuditCheck = pureCheck(16, "cross-references-valid", (ctx) => {
  const absoluteFileRefs = Markdown.findAbsolutePaths(ctx.body);
  return absoluteFileRefs.length > 0
    ? resultOf(
        16,
        "cross-references-valid",
        "warn",
        `${absoluteFileRefs.length} absolute path(s) found — prefer relative`,
      )
    : resultOf(16, "cross-references-valid", "pass", "All file references are relative");
});

const triggerConditions: AuditCheck = pureCheck(17, "trigger-conditions", (ctx) => {
  const hasWhenToUse =
    Markdown.containsKeyword(ctx.body, ["when to use"]) ||
    Markdown.hasSection(ctx.doc, "when") ||
    Markdown.hasSection(ctx.doc, "trigger");
  return hasWhenToUse
    ? resultOf(17, "trigger-conditions", "pass", "Trigger conditions defined")
    : resultOf(17, "trigger-conditions", "warn", "No 'When to use' or '## When' section found");
});

const outputSpecification: AuditCheck = pureCheck(18, "output-specification", (ctx) => {
  const hasOutputNearCode =
    ctx.doc.codeBlocks.length > 0 &&
    Markdown.containsKeyword(ctx.body, ["output", "result", "returns"]);
  return hasOutputNearCode
    ? resultOf(18, "output-specification", "pass", "Output specification found near code block")
    : resultOf(
        18,
        "output-specification",
        "warn",
        "No output specification found near code blocks",
      );
});

const noRedundancy: AuditCheck = pureCheck(19, "no-redundancy", (ctx) => {
  const redundancyStrings = [
    "Coordinator NEVER",
    "16-phase",
    "agent-first",
    "iteration-limit",
    "dirty-bit",
  ];
  const redundancyCount = Arr.filter(redundancyStrings, (s) => ctx.body.includes(s)).length;
  return redundancyCount > 3
    ? resultOf(
        19,
        "no-redundancy",
        "warn",
        `${redundancyCount} CLAUDE.md-specific strings found — skill may duplicate root instructions`,
      )
    : resultOf(19, "no-redundancy", "pass", "No excessive CLAUDE.md redundancy");
});

const namingConvention: AuditCheck = pureCheck(20, "naming-convention", (ctx) => {
  const basename = ctx.filePath.replace(/^.*\//, "").replace(/\.md$/, "");
  const validName = Markdown.isValidSkillName(basename);
  return validName
    ? resultOf(20, "naming-convention", "pass", `Filename "${basename}" follows convention`)
    : resultOf(
        20,
        "naming-convention",
        "warn",
        `Filename "${basename}" should be lowercase letters, digits, and hyphens`,
      );
});

const hasUpdatedDate: AuditCheck = pureCheck(21, "has-updated-date", (ctx) => {
  const hasDate = "updated" in ctx.fm || "created" in ctx.fm;
  return hasDate
    ? resultOf(21, "has-updated-date", "pass", "Date field present in frontmatter")
    : resultOf(21, "has-updated-date", "warn", "No updated/created date in frontmatter");
});

const notDeprecated: AuditCheck = pureCheck(22, "not-deprecated", (ctx) => {
  const isDeprecated = ctx.fm["deprecated"] === true;
  return isDeprecated
    ? resultOf(22, "not-deprecated", "fail", "Skill is marked as deprecated")
    : resultOf(22, "not-deprecated", "pass", "Skill is not deprecated");
});

const sectionsComplete: AuditCheck = pureCheck(23, "sections-complete", (ctx) => {
  const headers = Markdown.sectionHeaders(ctx.doc);
  return headers.length >= 2
    ? resultOf(23, "sections-complete", "pass", `${headers.length} sections found`)
    : resultOf(
        23,
        "sections-complete",
        "warn",
        "Fewer than 2 ## sections — consider adding structure",
      );
});

const readability: AuditCheck = pureCheck(24, "readability", (ctx) => {
  const longLines = Arr.filter(ctx.lines, (l) => l.length > 300);
  return longLines.length > 0
    ? resultOf(24, "readability", "warn", `${longLines.length} line(s) exceed 300 characters`)
    : resultOf(24, "readability", "pass", "All lines within 300 character limit");
});

const noSecrets: AuditCheck = pureCheck(25, "no-secrets", (ctx) => {
  const hasSecretPatterns = Markdown.hasSecretAssignment(ctx.content);
  return hasSecretPatterns
    ? resultOf(25, "no-secrets", "fail", "Potential secret values detected")
    : resultOf(25, "no-secrets", "pass", "No secret patterns found");
});

const noAbsolutePaths: AuditCheck = pureCheck(26, "no-absolute-paths", (ctx) => {
  return Markdown.findAbsolutePaths(ctx.body).length > 0
    ? resultOf(26, "no-absolute-paths", "warn", "Absolute user paths found")
    : resultOf(26, "no-absolute-paths", "pass", "No problematic absolute paths");
});

const noUnsafeCommands: AuditCheck = pureCheck(27, "no-unsafe-commands", (ctx) => {
  const unsafeCommands = [
    "rm -rf",
    "--force",
    "git push -f",
    "git push --force",
    "--no-verify",
    "drop table",
  ] as const;
  const hasUnsafe = unsafeCommands.some((cmd) => ctx.lowerBody.includes(cmd));
  return hasUnsafe
    ? resultOf(27, "no-unsafe-commands", "warn", "Unsafe commands detected in body")
    : resultOf(27, "no-unsafe-commands", "pass", "No unsafe commands found");
});

const noInjectionVectors: AuditCheck = pureCheck(28, "no-injection-vectors", (ctx) => {
  const hasInjection = Markdown.shellCodeBlocks(ctx.doc).some((block) =>
    block.content.includes("${"),
  );
  return hasInjection
    ? resultOf(
        28,
        "no-injection-vectors",
        "warn",
        "Shell variable interpolation found in code blocks",
      )
    : resultOf(28, "no-injection-vectors", "pass", "No injection vectors in shell blocks");
});

export const allChecks = (fs: FileSystemType, p: PathType): readonly AuditCheck[] => [
  hasName,
  hasDescription,
  sizeCheck,
  location,
  purposeStatement,
  actionableContent,
  hasExamples,
  hasConstraints,
  consistentVoice,
  sectionStructure,
  noPlaceholder,
  gatewayCompatible,
  agentBoundarySafe,
  makeDependencyCheck(fs, p),
  crossReferencesValid,
  triggerConditions,
  outputSpecification,
  noRedundancy,
  namingConvention,
  hasUpdatedDate,
  notDeprecated,
  sectionsComplete,
  readability,
  noSecrets,
  noAbsolutePaths,
  noUnsafeCommands,
  noInjectionVectors,
];
