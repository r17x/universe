import { Context, Effect, Layer, Ref } from "effect"
import { ulid } from "./Ulid"
import { Config } from "./Config"
import { EventLog } from "./EventLog"
import { MachineLoader, type MachineConfig } from "./MachineLoader"
import { MemoryStore } from "./MemoryStore"
import type { MemoryNode } from "./MemoryParser"
import { scaleOrder } from "./MemoryParser"

interface PhaseInfo {
  readonly id: string
  readonly name: string
  readonly number: number
}

export interface StartResult {
  readonly sessionId: string
  readonly phase: PhaseInfo
  readonly question: string
  readonly totalPhases: number
  readonly memories: readonly MemoryNode[]
}

export interface NextAdvanced {
  readonly _tag: "Advanced"
  readonly sessionId: string
  readonly phase: PhaseInfo
  readonly question: string
  readonly previousPhase: PhaseInfo
}

export interface NextCompleted {
  readonly _tag: "Completed"
  readonly sessionId: string
  readonly previousPhase: PhaseInfo
}

export type NextResult = NextAdvanced | NextCompleted

export interface PhaseEngineContract {
  readonly start: (task: string) => Effect.Effect<StartResult>
  readonly next: (answer: string, sessionId: string, size?: string) => Effect.Effect<NextResult>
  readonly observe: (text: string, sessionId: string) => Effect.Effect<void>
}

export class PhaseEngine extends Context.Service<PhaseEngine, PhaseEngineContract>()("@anakmagang/PhaseEngine") {
  static readonly layer = Layer.effect(
    PhaseEngine,
    Effect.gen(function* () {
      const config = yield* Config
      const loader = yield* MachineLoader
      const eventLog = yield* EventLog
      const store = yield* MemoryStore

      const machine = yield* loader.loadFromFile(config.configPath)

      const computeActivePhases = (size: string) => {
        const allPhases = machine.phases
        const presets = machine.size_presets
        if (!presets) return allPhases

        const preset = presets[size]
        if (!preset) return allPhases

        if (preset.phases) {
          if (preset.phases.includes("all")) return allPhases
          return allPhases.filter((p) => preset.phases!.includes(p.id))
        }

        if (preset.skip) {
          const skipSet = new Set(preset.skip)
          return allPhases.filter((p) => !skipSet.has(p.id))
        }

        return allPhases
      }

      const toPhaseInfo = (phase: typeof MachineConfig.Type["phases"][number]): PhaseInfo => ({
        id: phase.id,
        name: phase.name,
        number: machine.phases.indexOf(phase) + 1,
      })

      const generateSessionId = () => ulid()

      return {
        start: Effect.fn("PhaseEngine.start")(function* (task: string) {
          const sessionId = generateSessionId()

          yield* eventLog.createSession(sessionId).pipe(Effect.orDie)

          const ts = new Date().toISOString()
          yield* eventLog.appendManifest(sessionId, { type: "task_start", task, ts }).pipe(Effect.orDie)

          const firstPhase = machine.phases[0]
          yield* eventLog.appendManifest(sessionId, {
            type: "phase_advance",
            phase: firstPhase.id,
            reflection: "",
            ts,
          }).pipe(Effect.orDie)

          const stopWords = new Set(["the", "and", "for", "with", "from", "into", "that", "this", "will", "can", "not", "but", "has", "have", "was", "are", "been"])
          const keywords = task.split(/\s+/)
            .map(w => w.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            .filter(w => w.length > 2 && !stopWords.has(w))

          const memories = yield* store.query(keywords, { state: "ACTIVE" }).pipe(
            Effect.orElseSucceed((): readonly MemoryNode[] => [])
          )

          const minScaleIdx = scaleOrder.indexOf("finding")
          const filtered = memories.filter(m => scaleOrder.indexOf(m.scale) >= minScaleIdx)

          return {
            sessionId,
            phase: toPhaseInfo(firstPhase),
            question: firstPhase.exit_question,
            totalPhases: machine.phases.length,
            memories: filtered,
          } satisfies StartResult
        }),

        next: Effect.fn("PhaseEngine.next")(function* (answer: string, sessionId: string, size?: string) {

          const currentPhaseId = yield* eventLog.currentPhase(sessionId).pipe(Effect.orDie)
          const taskSizeRef = yield* Ref.make(yield* eventLog.taskSize(sessionId).pipe(Effect.orDie))
          const currentTask = yield* eventLog.currentTask(sessionId).pipe(Effect.orDie)

          if (currentPhaseId === undefined && (yield* Ref.get(taskSizeRef))) {
            const completionPhase = machine.phases[machine.phases.length - 1]
            return {
              _tag: "Completed",
              sessionId,
              previousPhase: toPhaseInfo(completionPhase),
            } satisfies NextCompleted
          }

          const isSetup = currentPhaseId === machine.phases[0].id && !(yield* Ref.get(taskSizeRef))

          if (isSetup) {
            if (!size) {
              return yield* Effect.die(
                new Error("Size classification required to complete setup. Pass --size <TRIVIAL|SMALL|MEDIUM|LARGE>")
              )
            }
            const ts = new Date().toISOString()
            yield* eventLog.appendManifest(sessionId, {
              type: "task_start",
              task: currentTask ?? "",
              size,
              ts,
            }).pipe(Effect.orDie)
            yield* Ref.set(taskSizeRef, size)
          }

          const taskSize = yield* Ref.get(taskSizeRef)
          const activePhases = computeActivePhases(taskSize ?? "MEDIUM")
          const currentIdx = activePhases.findIndex((p) => p.id === currentPhaseId)
          if (currentIdx < 0) {
            return yield* Effect.die(
              new Error(`Current phase '${currentPhaseId}' not found in active phases for size ${taskSize}. Session may be corrupted.`)
            )
          }
          const currentPhase = activePhases[currentIdx]
          const previousPhaseInfo = toPhaseInfo(currentPhase)

          const ts = new Date().toISOString()

          yield* eventLog.appendManifest(sessionId, {
            type: "phase_advance",
            phase: currentPhase.id,
            reflection: answer,
            ts,
          }).pipe(Effect.orDie)

          const nextIdx = currentIdx + 1
          if (nextIdx >= activePhases.length) {
            yield* eventLog.appendManifest(sessionId, {
              type: "phase_advance",
              phase: "completion",
              reflection: "",
              ts,
            }).pipe(Effect.orDie)

            return {
              _tag: "Completed",
              sessionId,
              previousPhase: previousPhaseInfo,
            } satisfies NextCompleted
          }

          const nextPhase = activePhases[nextIdx]

          yield* eventLog.appendManifest(sessionId, {
            type: "phase_advance",
            phase: nextPhase.id,
            reflection: "",
            ts,
          }).pipe(Effect.orDie)

          return {
            _tag: "Advanced",
            sessionId,
            phase: toPhaseInfo(nextPhase),
            question: nextPhase.exit_question,
            previousPhase: previousPhaseInfo,
          } satisfies NextAdvanced
        }),

        observe: Effect.fn("PhaseEngine.observe")(function* (text: string, sessionId: string) {
          const ts = new Date().toISOString()
          yield* eventLog.appendManifest(sessionId, { type: "observation", text, ts }).pipe(Effect.orDie)
        }),
      }
    }),
  )
}
