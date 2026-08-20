import { describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { AgentAuditor } from "../../../AgentAuditor";
import { SkillAuditor } from "../../../SkillAuditor";
import { Config } from "../../../Config";
import { MachineLoader } from "../../../MachineLoader";

const ITERATIONS = 10;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const projectRoot = new URL("../../../../../..", import.meta.url).pathname.replace(/\/$/, "");

const testLayers = Layer.mergeAll(AgentAuditor.layer, SkillAuditor.layer).pipe(
  Layer.provide(Layer.merge(Config.layer, MachineLoader.layer)),
  Layer.provideMerge(BunServices.layer),
);

const run = <A, E>(effect: Effect.Effect<A, E, AgentAuditor | SkillAuditor>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayers)));

const singleAgentFile = `${projectRoot}/.claude/agents/effect-ts.md`;
const singleSkillFile = `${projectRoot}/.claude/skills/orchestrate/SKILL.md`;

describe("Agent Audit", () => {
  test("AgentAuditor.audit(singleFile)", async () => {
    await measureAsync("AgentAuditor.audit(singleFile)", async () => {
      await run(
        Effect.gen(function* () {
          const auditor = yield* AgentAuditor;
          yield* auditor.audit(singleAgentFile);
        }),
      );
    });
  });

  test("AgentAuditor.auditAll()", async () => {
    await measureAsync("AgentAuditor.auditAll()", async () => {
      await run(
        Effect.gen(function* () {
          const auditor = yield* AgentAuditor;
          yield* auditor.auditAll();
        }),
      );
    });
  });
});

describe("Skill Audit", () => {
  test("SkillAuditor.audit(singleFile)", async () => {
    await measureAsync("SkillAuditor.audit(singleFile)", async () => {
      await run(
        Effect.gen(function* () {
          const auditor = yield* SkillAuditor;
          yield* auditor.audit(singleSkillFile);
        }),
      );
    });
  });

  test("SkillAuditor.auditAll()", async () => {
    await measureAsync("SkillAuditor.auditAll()", async () => {
      await run(
        Effect.gen(function* () {
          const auditor = yield* SkillAuditor;
          yield* auditor.auditAll();
        }),
      );
    });
  });
});

describe("Combined", () => {
  test("auditAll concurrent (agents + skills)", async () => {
    await measureAsync("auditAll concurrent (agents + skills)", async () => {
      await run(
        Effect.gen(function* () {
          const agentAuditor = yield* AgentAuditor;
          const skillAuditor = yield* SkillAuditor;
          yield* Effect.all([agentAuditor.auditAll(), skillAuditor.auditAll()], { concurrency: 2 });
        }),
      );
    });
  });
});
