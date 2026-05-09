import { describe, test, expect } from "bun:test"
import { Effect } from "effect"
import { MachineLoader } from "../MachineLoader"

const loadPreset = (name: string) =>
  Effect.gen(function* () {
    const loader = yield* MachineLoader
    return yield* loader.loadPreset(name)
  }).pipe(Effect.provide(MachineLoader.layer))

describe("MachineLoader.loadPreset", () => {
  test("known preset r17x-orchestrate succeeds with 16 phases", async () => {
    const result = await Effect.runPromise(loadPreset("r17x-orchestrate"))
    expect(result.phases.length).toBe(16)
  })

  test("unknown preset fails with MachineLoadError", async () => {
    const exit = await Effect.runPromiseExit(loadPreset("nonexistent"))
    expect(exit._tag).toBe("Failure")
  })

  test("config name matches preset name", async () => {
    const result = await Effect.runPromise(loadPreset("r17x-orchestrate"))
    expect(result.name).toBe("r17x-orchestrate")
  })

  test("all phases have required fields", async () => {
    const result = await Effect.runPromise(loadPreset("r17x-orchestrate"))
    for (const phase of result.phases) {
      expect(typeof phase.id).toBe("string")
      expect(phase.id.length).toBeGreaterThan(0)
      expect(typeof phase.name).toBe("string")
      expect(phase.name.length).toBeGreaterThan(0)
      expect(typeof phase.exit_question).toBe("string")
      expect(phase.exit_question.length).toBeGreaterThan(0)
      expect(phase.next === null || typeof phase.next === "string").toBe(true)
    }
  })
})
