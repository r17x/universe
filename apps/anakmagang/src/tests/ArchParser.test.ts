import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { Effect, Layer } from "effect"
import { ArchParser } from "../ArchParser"
import { BunServices } from "@effect/platform-bun"

describe("ArchParser", () => {
  let originalCwd: string

  beforeAll(() => {
    originalCwd = process.cwd()
    process.chdir(new URL("../../../../", import.meta.url).pathname)
  })

  afterAll(() => {
    process.chdir(originalCwd)
  })

  const TestLayer = ArchParser.layer.pipe(Layer.provideMerge(BunServices.layer))

  const runWithArch = <A, E>(effect: Effect.Effect<A, E, ArchParser>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(TestLayer)
      )
    )

  test("getDomainRouting extracts routes from table", async () => {
    const result = await runWithArch(
      Effect.gen(function* () {
        const parser = yield* ArchParser
        return yield* parser.getDomainRouting()
      })
    )
    expect(result.length).toBeGreaterThan(0)
    const tsRoute = result.find(r => r.domain === "TypeScript apps")
    expect(tsRoute).toBeDefined()
    expect(tsRoute!.workerAgent).toBe("effect-ts")
  })

  test("getVerificationCommands extracts bash blocks", async () => {
    const result = await runWithArch(
      Effect.gen(function* () {
        const parser = yield* ArchParser
        return yield* parser.getVerificationCommands()
      })
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain("nix flake check --no-build")
  })
})
