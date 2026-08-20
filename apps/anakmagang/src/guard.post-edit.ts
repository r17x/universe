import * as Effect from "effect/Effect";
import { Allow, Warn } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

export const postEdit: GuardFn = (ctx) =>
  Effect.gen(function* () {
    const filePath = ctx.input.tool_input?.["file_path"] ?? ctx.input.tool_input?.["file"];
    if (filePath === undefined || typeof filePath !== "string") return Allow();

    const filePattern = ctx.guard.file_pattern;
    if (filePattern !== undefined) {
      if (!new RegExp(filePattern).test(filePath)) return Allow();
    }

    const command = ctx.guard.command;
    if (command === undefined) return Allow();

    const resolved = command.replaceAll("{file}", filePath);
    const spawn = () =>
      Bun.spawn(["sh", "-c", resolved], {
        cwd: ctx.env.CLAUDE_PROJECT_DIR,
        stdout: "pipe",
        stderr: "pipe",
      });
    const proc = yield* Effect.try({
      try: spawn,
      catch: () => undefined,
    }).pipe(Effect.orElseSucceed(() => undefined as ReturnType<typeof spawn> | undefined));
    if (proc === undefined) return Allow();
    const exitCode = yield* Effect.promise(() => proc.exited);
    if (exitCode !== 0) {
      const stderr = yield* Effect.promise(() => new Response(proc.stderr).text());
      return Warn({
        message: `WARNING: post-edit command failed for ${filePath}:\n${stderr.slice(0, 500)}`,
      });
    }
    return Allow();
  });
