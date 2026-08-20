import { Command } from "effect/unstable/cli";
import { Array as Arr, Effect, Option, Ref } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { MemoryStore, type MemoryNodeInput, toId } from "./MemoryStore";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";

const REFERENCES_DIR = ".anakmagang/references";

export const memoryIndexCommand = Command.make("index", {}, () =>
  Effect.gen(function* () {
    const store = yield* MemoryStore;
    const fs = yield* FileSystem;
    const p = yield* Path;
    const output = yield* Output;

    const refsDir = p.resolve(REFERENCES_DIR);
    const dirExists = yield* fs.exists(refsDir).pipe(Effect.orElseSucceed(() => false));

    if (!dirExists) {
      yield* output.emit(Line({ text: "No references directory found" }));
      return;
    }

    const entries = yield* fs
      .readDirectory(refsDir)
      .pipe(Effect.orElseSucceed(() => [] as string[]));
    const indexed = yield* Ref.make<readonly string[]>([]);
    const skipped = yield* Ref.make<readonly string[]>([]);

    yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function* () {
        const fullPath = p.join(refsDir, entry);
        const statOpt = yield* fs.stat(fullPath).pipe(Effect.option);
        if (Option.isNone(statOpt)) return;
        const stat = statOpt.value;
        const isDir = stat.type === "Directory";
        const isMd = !isDir && entry.endsWith(".md");

        if (!isDir && !isMd) return;

        const name = isMd ? entry.replace(/\.md$/, "") : entry;

        const input: MemoryNodeInput = yield* isMd
          ? Effect.gen(function* () {
              const body = yield* fs.readFileString(fullPath).pipe(Effect.orElseSucceed(() => ""));
              const firstLine =
                body
                  .split("\n")
                  .find((l) => l.trim().length > 0)
                  ?.trim() ?? `Reference: ${name}`;
              return {
                name,
                description: firstLine,
                type: "reference" as const,
                scale: "observation" as const,
                body,
                source: "ephemeral" as const,
              };
            })
          : Effect.gen(function* () {
              const readmePath = p.join(fullPath, "README.md");
              const readmeExists = yield* fs
                .exists(readmePath)
                .pipe(Effect.orElseSucceed(() => false));
              const body = readmeExists
                ? yield* fs.readFileString(readmePath).pipe(
                    Effect.map((c) => c.slice(0, 500)),
                    Effect.orElseSucceed(() => ""),
                  )
                : "";
              return {
                name,
                description: `Reference: ${name}`,
                type: "reference" as const,
                scale: "observation" as const,
                body,
                source: "ephemeral" as const,
              };
            });

        const result = yield* store.create(input).pipe(
          Effect.map(() => "created" as const),
          Effect.catch(() => Effect.succeed("skipped" as const)),
        );

        if (result === "created") {
          yield* Ref.update(indexed, Arr.append(name));
        } else {
          yield* Ref.update(skipped, Arr.append(name));
        }
      }),
    );

    const existing = yield* store.list({ state: "ACTIVE" });
    const refNodes = Arr.filter(existing, (node) => node.type === "reference");
    const staleNodes = Arr.filter(
      refNodes,
      (node) =>
        !entries.some((e) => {
          const eName = e.endsWith(".md") ? e.replace(/\.md$/, "") : e;
          return toId(eName) === node.id;
        }),
    );
    const staled = yield* Effect.forEach(staleNodes, (node) =>
      store.transition(node.id, "STALE").pipe(Effect.map(() => node.id)),
    );

    const indexedVal = yield* Ref.get(indexed);
    const skippedVal = yield* Ref.get(skipped);
    yield* output.emit(
      Line({
        text: `Indexed: ${indexedVal.length} (${Arr.match(indexedVal, { onEmpty: () => "none", onNonEmpty: (a) => Arr.join(a, ", ") })})`,
      }),
    );
    yield* output.emit(
      Line({
        text: `Skipped: ${skippedVal.length} (${Arr.match(skippedVal, { onEmpty: () => "none", onNonEmpty: (a) => Arr.join(a, ", ") })})`,
      }),
    );
    yield* output.emit(
      Line({
        text: `Staled:  ${staled.length} (${Arr.match(staled, { onEmpty: () => "none", onNonEmpty: (a) => Arr.join(a, ", ") })})`,
      }),
    );
  }).pipe(Effect.provide(MemoryStore.layer)),
);
