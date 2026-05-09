import { Command } from "effect/unstable/cli"
import { Console, Effect } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"
import { MemoryStore, type MemoryNodeInput, toId } from "./MemoryStore"

const REFERENCES_DIR = ".data/references"

export const memoryIndexCommand = Command.make(
  "index",
  {},
  () =>
    Effect.gen(function* () {
      const store = yield* MemoryStore
      const fs = yield* FileSystem
      const p = yield* Path

      const refsDir = p.resolve(REFERENCES_DIR)
      const dirExists = yield* fs.exists(refsDir).pipe(Effect.orDie)

      if (!dirExists) {
        yield* Console.log("No references directory found")
        return
      }

      const entries = yield* fs.readDirectory(refsDir).pipe(Effect.orDie)
      const indexed: string[] = []
      const skipped: string[] = []
      const staled: string[] = []

      for (const entry of entries) {
        const fullPath = p.join(refsDir, entry)
        const stat = yield* fs.stat(fullPath).pipe(Effect.orDie)
        const isDir = stat.type === "Directory"
        const isMd = !isDir && entry.endsWith(".md")

        if (!isDir && !isMd) continue

        const name = isMd ? entry.replace(/\.md$/, "") : entry

        const input: MemoryNodeInput = yield* (isMd
          ? Effect.gen(function* () {
              const body = yield* fs.readFileString(fullPath).pipe(Effect.orDie)
              const firstLine = body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? `Reference: ${name}`
              return {
                name,
                description: firstLine,
                type: "reference" as const,
                scale: "observation" as const,
                body,
                source: "ephemeral" as const,
              }
            })
          : Effect.gen(function* () {
              const readmePath = p.join(fullPath, "README.md")
              const readmeExists = yield* fs.exists(readmePath).pipe(Effect.orDie)
              const body = readmeExists
                ? yield* fs.readFileString(readmePath).pipe(
                    Effect.map((c) => c.slice(0, 500)),
                    Effect.orDie,
                  )
                : ""
              return {
                name,
                description: `Reference: ${name}`,
                type: "reference" as const,
                scale: "observation" as const,
                body,
                source: "ephemeral" as const,
              }
            }))

        const result = yield* store.create(input).pipe(
          Effect.map(() => "created" as const),
          Effect.catch(() => Effect.succeed("skipped" as const)),
        )

        if (result === "created") {
          indexed.push(name)
        } else {
          skipped.push(name)
        }
      }

      const existing = yield* store.list({ state: "ACTIVE" })
      for (const node of existing) {
        if (node.type !== "reference") continue
        const matchesEntry = entries.some((e) => {
          const eName = e.endsWith(".md") ? e.replace(/\.md$/, "") : e
          return toId(eName) === node.id
        })
        if (!matchesEntry) {
          yield* store.transition(node.id, "STALE").pipe(Effect.orDie)
          staled.push(node.id)
        }
      }

      yield* Console.log(`Indexed: ${indexed.length} (${indexed.join(", ") || "none"})`)
      yield* Console.log(`Skipped: ${skipped.length} (${skipped.join(", ") || "none"})`)
      yield* Console.log(`Staled:  ${staled.length} (${staled.join(", ") || "none"})`)
    }).pipe(Effect.provide(MemoryStore.layer)),
)
