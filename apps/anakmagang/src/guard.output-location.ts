import { Array as Arr, Effect, Option } from "effect";
import { Path } from "effect/Path";
import { Allow, Block } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

export const outputLocation: GuardFn = (ctx) =>
  Effect.gen(function* () {
    const path = yield* Path;
    const raw = ctx.input.tool_input?.["file_path"] ?? ctx.input.tool_input?.["file"];
    if (raw === undefined || typeof raw !== "string") return Allow();

    const resolved = path.isAbsolute(raw) ? raw : path.join(ctx.env.CLAUDE_PROJECT_DIR, raw);
    const normalized = path.normalize(resolved);

    if (!normalized.startsWith(ctx.env.CLAUDE_PROJECT_DIR)) {
      return Block({
        message: `BLOCKED: Write target outside project directory.\nPath: ${normalized}\nProject: ${ctx.env.CLAUDE_PROJECT_DIR}`,
      });
    }

    const relative = path.relative(ctx.env.CLAUDE_PROJECT_DIR, normalized);
    const restricted = ctx.guard.restricted_paths ?? [];
    const restrictedPrefixes = [".git/", ...(ctx.guard.restricted_prefixes ?? [])];

    if (
      restricted.some((r) => relative === r) ||
      restrictedPrefixes.some((p) => relative.startsWith(p))
    ) {
      return Block({ message: `BLOCKED: Write to restricted path: ${relative}` });
    }

    const roStores = Arr.filter(ctx.current?.configStores ?? [], (s) => !s.writable);
    const blocked = Arr.findFirst(
      roStores,
      (a) => relative === a.path || relative.startsWith(a.path + "/"),
    );
    return Option.match(blocked, {
      onNone: () => Allow(),
      onSome: (a) =>
        Block({
          message: `BLOCKED: Write to read-only artifact store: ${a.path}\nPath: ${relative}`,
        }),
    });
  });
