import { Context, Effect, Layer } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import type { AuditReport, AuditResult } from "./AgentAuditor"
import { AuditError, makeSummary } from "./AgentAuditor"
import * as Yaml from "./Yaml"

const skip = (phase: number, check: string): AuditResult => ({
  phase,
  check,
  status: "fail",
  message: "Skipped: frontmatter validation failed",
})

const pass = (phase: number, check: string, message: string): AuditResult => ({
  phase,
  check,
  status: "pass",
  message,
})

const warn = (phase: number, check: string, message: string): AuditResult => ({
  phase,
  check,
  status: "warn",
  message,
})

const fail = (phase: number, check: string, message: string): AuditResult => ({
  phase,
  check,
  status: "fail",
  message,
})

const extractCodeBlocks = (body: string): readonly string[] =>
  Array.from(body.matchAll(/```[^\n]*\n([\s\S]*?)```/g), (m) => m[1])

const extractShellCodeBlocks = (body: string): readonly string[] =>
  Array.from(body.matchAll(/```(?:sh|bash|shell|zsh)[^\n]*\n([\s\S]*?)```/g), (m) => m[1])

export interface SkillAuditorContract {
  readonly audit: (filePath: string) => Effect.Effect<AuditReport, AuditError>
  readonly auditAll: () => Effect.Effect<readonly AuditReport[], AuditError>
}

export class SkillAuditor extends Context.Service<SkillAuditor, SkillAuditorContract>()("@anakmagang/SkillAuditor") {
  static readonly layer = Layer.effect(
    SkillAuditor,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const p = yield* Path

      const auditOne = Effect.fn("SkillAuditor.audit")(function* (filePath: string) {
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError(() => new AuditError({ target: filePath, message: "Cannot read file" }))
        )
        const results: AuditResult[] = []
        const lines = content.split("\n")
        const parsed = Yaml.parseFrontmatter(content)

        results.push(
          parsed !== null
            ? pass(1, "frontmatter-exists", "Frontmatter delimiters found")
            : fail(1, "frontmatter-exists", "Missing frontmatter delimiters")
        )

        if (parsed === null) {
          const skippedChecks = [
            "has-name", "has-description", "size-check", "location",
            "purpose-statement", "actionable-content", "has-examples", "has-constraints",
            "consistent-voice", "section-structure", "no-placeholder",
            "gateway-compatible", "agent-boundary-safe", "dependency-exists",
            "cross-references-valid", "trigger-conditions", "output-specification",
            "no-redundancy", "naming-convention", "has-updated-date", "not-deprecated",
            "sections-complete", "readability",
            "no-secrets", "no-absolute-paths", "no-unsafe-commands", "no-injection-vectors",
          ]
          skippedChecks.forEach((check, i) => {
            results.push(skip(i + 2, check))
          })
          return { target: filePath, type: "skill" as const, results, summary: makeSummary(results) }
        }

        const fm: Record<string, unknown> = parsed.fm
        const body = parsed.body
        const codeBlocks = extractCodeBlocks(body)
        const shellBlocks = extractShellCodeBlocks(body)

        const hasName = "name" in fm && typeof fm["name"] === "string" && fm["name"].length > 0
        results.push(
          hasName
            ? pass(2, "has-name", `Name: ${fm["name"]}`)
            : fail(2, "has-name", "Missing name field in frontmatter")
        )

        const hasDesc = "description" in fm && typeof fm["description"] === "string" && fm["description"].length > 0
        results.push(
          hasDesc
            ? pass(3, "has-description", "Description present")
            : fail(3, "has-description", "Missing description field in frontmatter")
        )

        const lineCount = lines.length
        results.push(
          lineCount <= 500
            ? pass(4, "size-check", `${lineCount} lines`)
            : lineCount <= 800
              ? warn(4, "size-check", `${lineCount} lines (>500, consider trimming)`)
              : fail(4, "size-check", `${lineCount} lines (>800, too large)`)
        )

        const inSkillsDir = filePath.includes(".claude/skills/")
        results.push(
          inSkillsDir
            ? pass(5, "location", "Located in .claude/skills/")
            : warn(5, "location", "Not in .claude/skills/ directory")
        )

        const firstParagraph = body.trim().split("\n\n")[0] || ""
        results.push(
          firstParagraph.length > 20
            ? pass(6, "purpose-statement", "Clear purpose statement found")
            : warn(6, "purpose-statement", "First paragraph too short or missing")
        )

        const hasCodeBlockMarker = body.includes("```")
        const hasSteps = /\d+\.\s/.test(body) || /^-\s/m.test(body)
        results.push(
          hasCodeBlockMarker || hasSteps
            ? pass(7, "actionable-content", "Actionable content found")
            : warn(7, "actionable-content", "No steps or code blocks found")
        )

        const hasMultiLineCodeBlock = codeBlocks.some((b) => b.trim().split("\n").length > 1)
        results.push(
          hasMultiLineCodeBlock
            ? pass(8, "has-examples", "Code examples found")
            : warn(8, "has-examples", "No multi-line code examples found")
        )

        const constraintPattern = /\b(DON'T|MUST NOT|NEVER|DO NOT|limit|constraint)\b/i
        results.push(
          constraintPattern.test(body)
            ? pass(9, "has-constraints", "Constraints defined")
            : warn(9, "has-constraints", "No constraint language found")
        )

        const passivePatterns = /\b(you should|you can|you need)\b/i
        const imperativePattern = /^[A-Z][a-z]+\s/m
        const hasPassive = passivePatterns.test(body)
        const hasImperative = imperativePattern.test(body)
        results.push(
          hasPassive && hasImperative
            ? warn(10, "consistent-voice", "Mixed passive and imperative voice detected")
            : pass(10, "consistent-voice", "Consistent voice")
        )

        const headers = body.match(/^##\s+.+$/gm) || []
        results.push(
          headers.length > 0
            ? pass(11, "section-structure", `${headers.length} section header(s) found`)
            : warn(11, "section-structure", "No ## headers found")
        )

        const placeholderPattern = /\b(TODO|FIXME|TBD|XXX|HACK)\b/
        results.push(
          placeholderPattern.test(body)
            ? fail(12, "no-placeholder", "Placeholder text found in body")
            : pass(12, "no-placeholder", "No placeholder text")
        )

        const mentionsNixDomain = /\b(nix|darwin)\b/i.test(body)
        const hasWhenToUse = /when to use/i.test(body) || /^##\s*when/im.test(body)
        results.push(
          mentionsNixDomain && !hasWhenToUse
            ? warn(13, "gateway-compatible", "Mentions nix/darwin but missing 'When to use' section")
            : pass(13, "gateway-compatible", "Gateway compatible")
        )

        const mentionsEditWrite = /\b(Edit tool|Write tool)\b/i.test(body)
        const mentionsCoordinator = /\bcoordinator\b/i.test(body)
        results.push(
          mentionsEditWrite && mentionsCoordinator
            ? warn(14, "agent-boundary-safe", "References Edit/Write tool and coordinator — potential boundary violation")
            : pass(14, "agent-boundary-safe", "Agent boundary safe")
        )

        const skillPathRefs = body.match(/\.claude\/skills\/[^\s)]+\.md/g) || []
        const depResults: AuditResult[] = []
        if (skillPathRefs.length > 0) {
          for (const ref of skillPathRefs) {
            const resolved = p.resolve(ref)
            const exists = yield* fs.exists(resolved).pipe(Effect.orDie)
            if (!exists) {
              depResults.push(fail(15, "dependency-exists", `Referenced skill not found: ${ref}`))
            }
          }
        }
        results.push(
          depResults.length > 0
            ? depResults[0]
            : pass(15, "dependency-exists", skillPathRefs.length > 0 ? `All ${skillPathRefs.length} skill reference(s) exist` : "No skill references to check")
        )

        const absoluteFileRefs = body.match(/(?:\/Users\/|\/home\/|\/etc\/|C:\\)[^\s)]+/g) || []
        results.push(
          absoluteFileRefs.length > 0
            ? warn(16, "cross-references-valid", `${absoluteFileRefs.length} absolute path(s) found — prefer relative`)
            : pass(16, "cross-references-valid", "All file references are relative")
        )

        results.push(
          hasWhenToUse
            ? pass(17, "trigger-conditions", "Trigger conditions defined")
            : warn(17, "trigger-conditions", "No 'When to use' or '## When' section found")
        )

        const outputPattern = /\b(output|result|returns)\b/i
        const hasOutputNearCode = codeBlocks.length > 0 && outputPattern.test(body)
        results.push(
          hasOutputNearCode
            ? pass(18, "output-specification", "Output specification found near code block")
            : warn(18, "output-specification", "No output specification found near code blocks")
        )

        const redundancyStrings = ["Coordinator NEVER", "16-phase", "agent-first", "iteration-limit", "dirty-bit"]
        const redundancyCount = redundancyStrings.filter((s) => body.includes(s)).length
        results.push(
          redundancyCount > 3
            ? warn(19, "no-redundancy", `${redundancyCount} CLAUDE.md-specific strings found — skill may duplicate root instructions`)
            : pass(19, "no-redundancy", "No excessive CLAUDE.md redundancy")
        )

        const basename = p.basename(filePath).replace(/\.md$/, "")
        const validName = /^[a-z][a-z0-9-]*$/.test(basename)
        results.push(
          validName
            ? pass(20, "naming-convention", `Filename "${basename}" follows convention`)
            : warn(20, "naming-convention", `Filename "${basename}" should match /^[a-z][a-z0-9-]*$/`)
        )

        const hasDate = "updated" in fm || "created" in fm
        results.push(
          hasDate
            ? pass(21, "has-updated-date", "Date field present in frontmatter")
            : warn(21, "has-updated-date", "No updated/created date in frontmatter")
        )

        const isDeprecated = fm["deprecated"] === true
        results.push(
          isDeprecated
            ? fail(22, "not-deprecated", "Skill is marked as deprecated")
            : pass(22, "not-deprecated", "Skill is not deprecated")
        )

        results.push(
          headers.length >= 2
            ? pass(23, "sections-complete", `${headers.length} sections found`)
            : warn(23, "sections-complete", "Fewer than 2 ## sections — consider adding structure")
        )

        const longLines = lines.filter((l) => l.length > 300)
        results.push(
          longLines.length > 0
            ? warn(24, "readability", `${longLines.length} line(s) exceed 300 characters`)
            : pass(24, "readability", "All lines within 300 character limit")
        )

        const secretPatterns = [
          /(?:api[_-]?key|apikey)\s*[:=]\s*['"]\S+/i,
          /(?:password|passwd|secret)\s*[:=]\s*['"]\S+/i,
          /(?:token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}/i,
        ]
        const hasSecrets = secretPatterns.some((pat) => pat.test(content))
        results.push(
          hasSecrets
            ? fail(25, "no-secrets", "Potential secret values detected")
            : pass(25, "no-secrets", "No secret patterns found")
        )

        const absPathPattern = /\/Users\/|\/home\/|C:\\Users\\/
        results.push(
          absPathPattern.test(body)
            ? warn(26, "no-absolute-paths", "Absolute user paths found")
            : pass(26, "no-absolute-paths", "No problematic absolute paths")
        )

        const unsafePattern = /rm\s+-rf|--force|git\s+push\s+-f|--no-verify|drop\s+table/i
        results.push(
          unsafePattern.test(body)
            ? warn(27, "no-unsafe-commands", "Unsafe commands detected in body")
            : pass(27, "no-unsafe-commands", "No unsafe commands found")
        )

        const hasInjection = shellBlocks.some((block) => block.includes("${"))
        results.push(
          hasInjection
            ? warn(28, "no-injection-vectors", "Shell variable interpolation found in code blocks")
            : pass(28, "no-injection-vectors", "No injection vectors in shell blocks")
        )

        return { target: filePath, type: "skill" as const, results, summary: makeSummary(results) }
      })

      return {
        audit: auditOne,
        auditAll: Effect.fn("SkillAuditor.auditAll")(function* () {
          const skillsDir = p.resolve(".claude", "skills")
          const exists = yield* fs.exists(skillsDir).pipe(Effect.orDie)
          if (!exists) { const empty: readonly AuditReport[] = []; return empty }
          const entries = yield* fs.readDirectory(skillsDir).pipe(Effect.orDie)
          const mdFiles = entries.filter((e) => e.endsWith(".md"))
          const reports = yield* Effect.forEach(mdFiles, (file) =>
            auditOne(p.join(skillsDir, file))
          , { concurrency: "unbounded" })
          return reports
        }),
      }
    })
  )
}
