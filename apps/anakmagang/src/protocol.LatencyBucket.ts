import { Array as Arr, Order } from "effect";
import type { GuardConfig } from "./protocol.GuardConfig";

export type LatencyBucket = "always-local" | "local-first" | "round-trip";

export const guardBucket: Record<string, LatencyBucket> = {
  "agent-first": "always-local",
  "output-location": "always-local",
  "agent-stop-guard": "always-local",
  "command-substitute": "always-local",
  "reflection-required": "always-local",
  "compaction-gate": "local-first",
  "iteration-limit": "local-first",
  "session-stop-guard": "local-first",
  "inject-reminders": "local-first",
  "post-edit": "round-trip",
};

const bucketOrder: readonly LatencyBucket[] = ["always-local", "local-first", "round-trip"];

export const sortByBucket = <T extends GuardConfig>(guards: ReadonlyArray<T>) =>
  Arr.sort(
    guards,
    Order.mapInput(Order.Number, (g: T) =>
      bucketOrder.indexOf(guardBucket[g.type] ?? "round-trip"),
    ),
  );
