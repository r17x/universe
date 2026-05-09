import { Context, Data, Effect, Layer } from "effect"
import { FileSystem } from "effect/FileSystem"
import { Path } from "effect/Path"

export interface DomainRoute {
  readonly domain: string
  readonly filePatterns: readonly string[]
  readonly workerAgent: string
}

export interface Convention {
  readonly name: string
  readonly value: string
}

export class ArchParserError extends Data.TaggedError("ArchParserError")<{
  readonly message: string
}> {}

export interface ArchParserContract {
  readonly getDomainRouting: () => Effect.Effect<readonly DomainRoute[], ArchParserError>
  readonly getVerificationCommands: () => Effect.Effect<readonly string[], ArchParserError>
}

export class ArchParser extends Context.Service<ArchParser, ArchParserContract>()("@anakmagang/ArchParser") {
  static readonly layer = Layer.effect(
    ArchParser,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const path = yield* Path

      const archPath = path.resolve("ARCHITECTURE.md")

      const readArch = Effect.fn("ArchParser.readArch")(function* () {
        return yield* fs.readFileString(archPath).pipe(
          Effect.mapError(() => new ArchParserError({ message: `ARCHITECTURE.md not found or unreadable at ${archPath}` }))
        )
      })

      return {
        getDomainRouting: Effect.fn("ArchParser.getDomainRouting")(function* () {
          const content = yield* readArch()
          const lines = content.split("\n")
          const routes = lines.reduce<{ inTable: boolean; headerPassed: boolean; routes: DomainRoute[] }>(
            (acc, line) => {
              const trimmed = line.trim()
              if (!acc.inTable) {
                if (trimmed.startsWith("| Domain") && trimmed.includes("Worker Agent")) {
                  return { ...acc, inTable: true }
                }
                return acc
              }
              if (!acc.headerPassed) {
                if (trimmed.startsWith("|---")) return { ...acc, headerPassed: true }
                return acc
              }
              if (!trimmed.startsWith("|")) return { ...acc, inTable: false }
              const cells = trimmed.split("|").map(c => c.trim()).filter(c => c !== "")
              if (cells.length >= 3 && cells[0] !== "") {
                const domain = cells[0]
                const patterns = cells[1].split(",").map(p => p.trim().replace(/`/g, "")).filter(p => p !== "")
                const worker = cells[2].replace(/`/g, "").trim()
                return { ...acc, routes: [...acc.routes, { domain, filePatterns: patterns, workerAgent: worker }] }
              }
              return acc
            },
            { inTable: false, headerPassed: false, routes: [] },
          ).routes
          if (routes.length === 0) {
            return yield* new ArchParserError({ message: "No domain routes found in ARCHITECTURE.md" })
          }
          return routes
        }),

        getVerificationCommands: Effect.fn("ArchParser.getVerificationCommands")(function* () {
          const content = yield* readArch()
          const lines = content.split("\n")
          const commands = lines.reduce<{ inSection: boolean; inCodeBlock: boolean; commands: string[] }>(
            (acc, line) => {
              if (!acc.inSection) {
                if (line.startsWith("## Verification Commands")) return { ...acc, inSection: true }
                return acc
              }
              if (line.startsWith("## ") && !line.startsWith("## Verification")) return { ...acc, inSection: false }
              if (!acc.inCodeBlock) {
                if (line.trim().startsWith("```bash")) return { ...acc, inCodeBlock: true }
                return acc
              }
              if (line.trim().startsWith("```")) return { ...acc, inCodeBlock: false }
              const trimmed = line.trim()
              if (trimmed !== "" && !trimmed.startsWith("#")) {
                return { ...acc, commands: [...acc.commands, trimmed] }
              }
              return acc
            },
            { inSection: false, inCodeBlock: false, commands: [] },
          ).commands
          return commands
        }),
      }
    })
  )
}
