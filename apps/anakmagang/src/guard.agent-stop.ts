import * as Effect from "effect/Effect";
import { Allow, Block, Warn } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

const fileModificationMarkers =
  /\b(Edit(ed|ing)?|Writ(e|ing|ten)|modif(ied|ying)|chang(ed|ing)|creat(ed|ing)|updat(ed|ing)|wrote)\b/i;

const looksLikeFileModification = (output: string, pattern: string): boolean => {
  const regex = new RegExp(pattern);
  const lines = output.split("\n");
  return lines.some((line) => {
    if (!regex.test(line)) return false;
    return /[/\\]/.test(line) || fileModificationMarkers.test(line);
  });
};

const executionMarkers = /\b(ran|executed|running|output|result|verified)\b/i;

const looksLikeExecution = (output: string, cmd: string): boolean => {
  if (!output.includes(cmd)) return false;
  const lines = output.split("\n");
  return lines.some((line) => {
    if (!line.includes(cmd)) return false;
    return (
      /^[$>]/.test(line.trim()) ||
      executionMarkers.test(line) ||
      line.trim().startsWith("```") ||
      /^\s{4,}/.test(line)
    );
  });
};

export const agentStopGuard: GuardFn = (ctx) =>
  Effect.sync(() => {
    const output = ctx.input.output ?? ctx.input.transcript ?? ctx.input.result;

    if (output === undefined) return Allow();

    const verificationRules = ctx.guard.verification_rules ?? [];
    const failedRule = verificationRules.find(
      (rule) =>
        looksLikeFileModification(output, rule.file_pattern) &&
        !rule.required_commands.some((cmd) => looksLikeExecution(output, cmd)),
    );
    if (failedRule) return Block({ message: `BLOCKED: ${failedRule.message}` });

    if (ctx.guard.promises?.length) {
      const promises = ctx.guard.promises;
      const hasPromise = promises.some((p) => output.includes(p));
      if (!hasPromise) {
        return Warn({
          message: `WARN: Worker output does not contain a completion promise. Expected one of: ${promises.join(", ")}`,
        });
      }
    }

    return Allow();
  });
