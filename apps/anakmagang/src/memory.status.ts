import { Command } from "effect/unstable/cli"
import { Console, Effect } from "effect"
import { MemoryStore } from "./MemoryStore"

const formatRecord = (rec: Record<string, number>): string =>
  Object.entries(rec).map(([k, v]) => `${k}=${v}`).join(", ")

export const memoryStatusCommand = Command.make("status", {}, () =>
  Effect.gen(function* () {
    const store = yield* MemoryStore
    const s = yield* store.status()
    yield* Console.log(`Total: ${s.total}`)
    yield* Console.log(`By state: ${formatRecord(s.byState)}`)
    yield* Console.log(`By scale: ${formatRecord(s.byScale)}`)
    yield* Console.log(`By type: ${formatRecord(s.byType)}`)
    yield* Console.log(`By source: ${formatRecord(s.bySource)}`)
  }).pipe(Effect.provide(MemoryStore.layer))
)
