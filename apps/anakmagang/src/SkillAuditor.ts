import { Context, Effect, Layer } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import type { AuditReport, AuditError, FixResult } from "./AgentAuditor";
import { makeAuditor, resultOf } from "./AuditShared";
import { allChecks } from "./checks.skill";

export interface SkillAuditorContract {
  readonly audit: (filePath: string) => Effect.Effect<AuditReport, AuditError>;
  readonly auditAll: () => Effect.Effect<readonly AuditReport[], AuditError>;
  readonly fix: (filePath: string) => Effect.Effect<FixResult, AuditError>;
  readonly fixAll: () => Effect.Effect<readonly FixResult[], AuditError>;
}

export class SkillAuditor extends Context.Service<SkillAuditor, SkillAuditorContract>()(
  "@anakmagang/SkillAuditor",
) {
  static readonly layer = Layer.effect(
    SkillAuditor,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const p = yield* Path;
      return yield* makeAuditor({
        type: "skill",
        dirSegments: [".claude", "skills"],
        frontmatterCheckName: "frontmatter-exists",
        checks: allChecks(fs, p),
        validateFrontmatter: (parsed) =>
          parsed !== null
            ? resultOf(1, "frontmatter-exists", "pass", "Frontmatter delimiters found")
            : resultOf(1, "frontmatter-exists", "fail", "Missing frontmatter delimiters"),
      });
    }),
  );
}
