import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option, Schema } from "effect"
import { Search, FindOpts, GrepOpts, DirSearchOpts, MixedSearchOpts } from "./Search"

const findFlags = {
  currentFile: Flag.string("current-file").pipe(Flag.withAlias("f"), Flag.optional),
  threads: Flag.integer("threads").pipe(Flag.withAlias("t"), Flag.optional),
  page: Flag.integer("page").pipe(Flag.withAlias("p"), Flag.optional),
  pageSize: Flag.integer("page-size").pipe(Flag.withAlias("s"), Flag.optional),
  comboBoost: Flag.integer("combo-boost").pipe(Flag.withAlias("c"), Flag.optional),
  minCombo: Flag.integer("min-combo").pipe(Flag.withAlias("n"), Flag.optional),
}

const dirFlags = {
  currentFile: Flag.string("current-file").pipe(Flag.withAlias("f"), Flag.optional),
  threads: Flag.integer("threads").pipe(Flag.withAlias("t"), Flag.optional),
  page: Flag.integer("page").pipe(Flag.withAlias("p"), Flag.optional),
  pageSize: Flag.integer("page-size").pipe(Flag.withAlias("s"), Flag.optional),
}

const grepFlags = {
  mode: Flag.choice("mode", ["plain", "regex", "fuzzy"] as const).pipe(Flag.withAlias("m"), Flag.optional),
  glob: Flag.string("glob").pipe(Flag.withAlias("g"), Flag.optional),
  maxFileSize: Flag.integer("max-file-size").pipe(Flag.withAlias("S"), Flag.optional),
  maxPerFile: Flag.integer("max-per-file").pipe(Flag.withAlias("M"), Flag.optional),
  smartCase: Flag.boolean("smart-case").pipe(Flag.withAlias("i"), Flag.optional),
  offset: Flag.integer("offset").pipe(Flag.withAlias("o"), Flag.optional),
  limit: Flag.integer("limit").pipe(Flag.withAlias("l"), Flag.optional),
  timeBudget: Flag.integer("time-budget").pipe(Flag.withAlias("T"), Flag.optional),
  before: Flag.integer("before").pipe(Flag.withAlias("B"), Flag.optional),
  after: Flag.integer("after").pipe(Flag.withAlias("A"), Flag.optional),
  definitions: Flag.boolean("definitions").pipe(Flag.withAlias("d"), Flag.optional),
}

const { mode: _, ...grepFlagsWithoutMode } = grepFlags

const SearchLayer = Search.layer

const findCommand = Command.make(
  "find",
  { query: Argument.string("query").pipe(Argument.withSchema(Schema.NonEmptyString)), ...findFlags },
  ({ query, ...flags }) =>
    Effect.gen(function* () {
      const search = yield* Search
      const opts = yield* Schema.encodeEffect(FindOpts)(flags)
      const result = yield* search.find(query, opts)
      yield* Effect.forEach(result.items, (item, i) =>
        Console.log(`${result.scores[i].total}\t${item.path}`)
      )
    }).pipe(Effect.scoped, Effect.provide(SearchLayer)),
)

const grepCommand = Command.make(
  "grep",
  { query: Argument.string("query").pipe(Argument.withSchema(Schema.NonEmptyString)), ...grepFlags },
  ({ query, ...flags }) =>
    Effect.gen(function* () {
      const search = yield* Search
      const opts = yield* Schema.encodeEffect(GrepOpts)(flags)
      const result = yield* search.grep(query, opts)
      for (const item of result.items) {
        yield* Console.log(`${item.path}:${item.lineNumber}: ${item.lineContent}`)
      }
    }).pipe(Effect.scoped, Effect.provide(SearchLayer)),
)

const multiGrepCommand = Command.make(
  "multi-grep",
  { patterns: Argument.string("patterns").pipe(Argument.withSchema(Schema.NonEmptyString)), ...grepFlagsWithoutMode },
  ({ patterns, ...flags }) =>
    Effect.gen(function* () {
      const search = yield* Search
      const opts = yield* Schema.encodeEffect(GrepOpts)({ mode: Option.none(), ...flags })
      const result = yield* search.multiGrep(patterns.split(","), opts)
      for (const item of result.items) {
        yield* Console.log(`${item.path}:${item.lineNumber}: ${item.lineContent}`)
      }
    }).pipe(Effect.scoped, Effect.provide(SearchLayer)),
)

const findDirsCommand = Command.make(
  "find-dirs",
  { query: Argument.string("query").pipe(Argument.withSchema(Schema.NonEmptyString)), ...dirFlags },
  ({ query, ...flags }) =>
    Effect.gen(function* () {
      const search = yield* Search
      const opts = yield* Schema.encodeEffect(DirSearchOpts)(flags)
      const result = yield* search.findDirectories(query, opts)
      yield* Effect.forEach(result.items, (item, i) =>
        Console.log(`${result.scores[i].total}\t${item.path}`)
      )
    }).pipe(Effect.scoped, Effect.provide(SearchLayer)),
)

const findMixedCommand = Command.make(
  "find-mixed",
  { query: Argument.string("query").pipe(Argument.withSchema(Schema.NonEmptyString)), ...findFlags },
  ({ query, ...flags }) =>
    Effect.gen(function* () {
      const search = yield* Search
      const opts = yield* Schema.encodeEffect(MixedSearchOpts)(flags)
      const result = yield* search.findMixed(query, opts)
      yield* Effect.forEach(result.items, (item, i) =>
        Console.log(`${item.type}\t${result.scores[i].total}\t${item.path}`)
      )
    }).pipe(Effect.scoped, Effect.provide(SearchLayer)),
)

const searchParent = Command.make("search", {}, () =>
  Console.log("Usage: anakmagang search <find|grep|multi-grep|find-dirs|find-mixed> <query>"),
)

export const searchCommand = Command.withSubcommands(searchParent, [findCommand, grepCommand, multiGrepCommand, findDirsCommand, findMixedCommand])
