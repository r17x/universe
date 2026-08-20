export {
  HookInputSchema,
  type HookInput,
  type HookEnv,
  type GuardContext,
  type GuardInput,
  type CurrentData,
  emptyCurrentData,
  type GuardResult,
  Allow,
  Info,
  Warn,
  Block,
  $is,
  $match,
} from "./protocol.GuardResult";
export { type GuardConfig, matchesTool, BridgeData } from "./protocol.GuardConfig";
export { type GuardEvaluatorContract, GuardEvaluator } from "./Middleware";
