import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Array as Arr, Console, Effect, Layer, Logger, Option, Result } from "effect";
import { cli } from "./cli";
import { Config } from "./Config";
import {
  Format,
  Output,
  agent,
  text,
  json,
  markdown,
  html,
  norg,
  toml,
  silent,
  type FormatFn,
} from "./protocol.Output";

const formats: ReadonlyArray<readonly [string, FormatFn]> = [
  ["agent", agent],
  ["text", text],
  ["json", json],
  ["markdown", markdown],
  ["html", html],
  ["norg", norg],
  ["toml", toml],
  ["silent", silent],
];

const validFormatNames = Arr.map(formats, ([name]) => name);

const parseFormatFromArgv = (
  argv: ReadonlyArray<string>,
): Result.Result<{ format: FormatFn; filtered: ReadonlyArray<string> }, string> => {
  const flagIdx = Option.orElse(
    Arr.findFirstIndex(argv, (a) => a === "--format"),
    () => Arr.findFirstIndex(argv, (a) => a === "-f"),
  );
  if (Option.isNone(flagIdx)) return Result.succeed({ format: agent, filtered: argv });
  const valueOpt = Arr.get(argv, flagIdx.value + 1);
  if (Option.isNone(valueOpt)) return Result.succeed({ format: agent, filtered: argv });
  const match = Arr.findFirst(formats, ([name]) => name === valueOpt.value);
  if (Option.isNone(match)) return Result.fail(valueOpt.value);
  const filtered = Arr.remove(Arr.remove(argv, flagIdx.value + 1), flagIdx.value);
  return Result.succeed({ format: match.value[1], filtered });
};

Result.match(parseFormatFromArgv(Bun.argv), {
  onFailure: (invalidName) =>
    BunRuntime.runMain(
      Console.error(
        `Invalid format: ${invalidName}. Valid formats: ${Arr.join(validFormatNames, ", ")}`,
      ).pipe(Effect.andThen(Effect.fail("invalid format")), Effect.provide(BunServices.layer)),
    ),
  onSuccess: ({ format, filtered }) => {
    const cliArgs = Arr.drop(filtered, 2);
    const formatLayer = Layer.succeed(Format, format);
    BunRuntime.runMain(
      cli(cliArgs).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.provideMerge(Config.layer, BunServices.layer),
            BunServices.layer,
            Layer.provideMerge(Output.layer, formatLayer),
            Layer.succeed(Logger.LogToStderr, true),
          ),
        ),
      ),
    );
  },
});
