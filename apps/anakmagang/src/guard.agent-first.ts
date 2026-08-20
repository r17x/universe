import * as Effect from "effect/Effect";
import { Allow, Block } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

const buildSuggestion = (filePath: unknown, routes: Record<string, string>): string => {
  if (typeof filePath !== "string") return "Delegate to the appropriate worker agent.";
  const ext = Object.keys(routes).find((k) => filePath.endsWith(k));
  return ext
    ? `Route via ${routes[ext]} worker agent.`
    : "Delegate to the appropriate worker agent.";
};

export const agentFirst: GuardFn = (ctx) =>
  Effect.sync(() => {
    if (ctx.input.agent_id?.trim()) {
      return Allow();
    }
    const filePath =
      ctx.input.tool_input?.["file_path"] ?? ctx.input.tool_input?.["file"] ?? "unknown";
    const routes = ctx.guard.routes ?? {};
    const suggestion = buildSuggestion(filePath, routes);
    return Block({
      message: `BLOCKED: Coordinator cannot use ${ctx.input.tool_name} directly.\nFile: ${String(filePath)}\n${suggestion}`,
    });
  });
