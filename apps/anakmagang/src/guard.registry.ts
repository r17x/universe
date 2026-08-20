import type { GuardFn } from "./guard.shared";
import { agentFirst } from "./guard.agent-first";
import { outputLocation } from "./guard.output-location";
import { compactionGate } from "./guard.compaction-gate";
import { iterationLimit } from "./guard.iteration-limit";
import { injectReminders } from "./guard.inject-reminders";
import { agentStopGuard } from "./guard.agent-stop";
import { sessionStopGuard } from "./guard.session-stop";
import { commandSubstitute } from "./guard.command-substitute";
import { postEdit } from "./guard.post-edit";
import { reflectionRequired } from "./guard.reflection-required";

export type { GuardFn };

export const makeGuardRegistry = (): Record<string, GuardFn> => ({
  "agent-first": agentFirst,
  "output-location": outputLocation,
  "compaction-gate": compactionGate,
  "iteration-limit": iterationLimit,
  "inject-reminders": injectReminders,
  "agent-stop-guard": agentStopGuard,
  "session-stop-guard": sessionStopGuard,
  "command-substitute": commandSubstitute,
  "post-edit": postEdit,
  "reflection-required": reflectionRequired,
});
