import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Effect } from "effect"
import { cli } from "./cli"

BunRuntime.runMain(
  cli.pipe(Effect.provide(BunServices.layer), Effect.asVoid)
)
