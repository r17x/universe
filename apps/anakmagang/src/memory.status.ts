import { Command } from "effect/unstable/cli";
import * as Effect from "effect/Effect";
import { MemoryStore } from "./MemoryStore";
import { Output } from "./protocol.Output";
import { Line } from "./protocol.Emission";

const formatRecord = (rec: Record<string, number>): string =>
  Object.entries(rec)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

export const memoryStatusCommand = Command.make("status", {}, () =>
  Effect.gen(function* () {
    const store = yield* MemoryStore;
    const output = yield* Output;
    const s = yield* store.status();
    yield* output.emit(Line({ text: `Total: ${s.total}` }));
    yield* output.emit(Line({ text: `By state: ${formatRecord(s.byState)}` }));
    yield* output.emit(Line({ text: `By scale: ${formatRecord(s.byScale)}` }));
    yield* output.emit(Line({ text: `By type: ${formatRecord(s.byType)}` }));
    yield* output.emit(Line({ text: `By source: ${formatRecord(s.bySource)}` }));
  }).pipe(Effect.provide(MemoryStore.layer)),
);
