import * as Effect from "effect/Effect";
import { Allow, Block } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const COMMAND_WRAPPERS = ["sudo", "env", "exec", "xargs", "nohup", "nice", "time", "doas"] as const;

const makeCommandPositionRegex = (pattern: string): RegExp => {
  const boundary = `(^|[|;&\\n\`(]|&&|\\|\\||\\$\\()`;
  const envVars = `(\\s*\\w+=\\S*\\s+)*`;
  const wrappers = `((?:${COMMAND_WRAPPERS.join("|")})\\s+)*`;
  return new RegExp(boundary + `\\s*` + envVars + wrappers + escapeRegex(pattern) + `\\b`);
};

export const commandSubstitute: GuardFn = (ctx) =>
  Effect.sync(() => {
    const command = ctx.input.tool_input?.["command"];
    if (command === undefined || typeof command !== "string") return Allow();
    const rules = ctx.guard.rules ?? [];
    const match = rules
      .flatMap((rule) => rule.contains.map((pattern: string) => ({ rule, pattern })))
      .find(({ pattern }: { pattern: string }) => makeCommandPositionRegex(pattern).test(command));
    if (match === undefined) return Allow();
    if (match.rule.unless_contains && command.includes(match.rule.unless_contains)) {
      return Allow();
    }
    return Block({ message: `BLOCKED: ${match.pattern} SHOULD: ${match.rule.should}` });
  });
