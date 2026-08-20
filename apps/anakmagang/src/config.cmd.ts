import { Argument, Command } from "effect/unstable/cli";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Config } from "./Config";
import { MachineConfig, MachineLoader, configToYaml } from "./MachineLoader";
import * as Yaml from "./Yaml";
import { Output } from "./protocol.Output";
import { Line, Diagnostic, Table, Record } from "./protocol.Emission";

const ConfigLayers = Layer.mergeAll(Config.layer, MachineLoader.layer);

const RecordSchema = Schema.Record(Schema.String, Schema.Unknown);
const isRecord = Schema.is(RecordSchema);

const booleanMap: globalThis.Record<string, boolean> = { true: true, false: false };

const coerceValue = (raw: string): string | number | boolean =>
  Option.fromNullishOr(booleanMap[raw]).pipe(
    Option.orElse(() => {
      const n = Number(raw);
      return !Number.isNaN(n) && raw !== "" ? Option.some(n) : Option.none();
    }),
    Option.getOrElse(() => raw),
  );

const getByPath = (obj: unknown, segments: ReadonlyArray<string>): Option.Option<unknown> => {
  if (segments.length === 0) return Option.some(obj);
  if (obj === null || obj === undefined) return Option.none();
  const head = segments[0] ?? "";
  const tail = segments.slice(1);
  if (Array.isArray(obj)) {
    const idx = Number(head);
    if (Number.isNaN(idx)) return Option.none();
    return Arr.get(obj, idx).pipe(Option.flatMap((child) => getByPath(child, tail)));
  }
  if (isRecord(obj)) {
    return Option.fromNullishOr(obj[head]).pipe(Option.flatMap((child) => getByPath(child, tail)));
  }
  return Option.none();
};

const setByPath = (obj: unknown, segments: ReadonlyArray<string>, value: unknown): unknown => {
  if (segments.length === 0) return value;
  const head = segments[0] ?? "";
  const tail = segments.slice(1);
  if (Array.isArray(obj)) {
    const idx = Number(head);
    if (Number.isNaN(idx)) return obj;
    const copy = [...obj];
    copy[idx] = setByPath(
      Arr.get(copy, idx).pipe(Option.getOrElse((): unknown => undefined)),
      tail,
      value,
    );
    return copy;
  }
  if (isRecord(obj)) {
    return { ...obj, [head]: setByPath(obj[head], tail, value) };
  }
  return { [head]: setByPath(undefined, tail, value) };
};

const deleteByPath = (obj: unknown, segments: ReadonlyArray<string>): unknown => {
  if (segments.length === 0) return undefined;
  return Arr.head(segments).pipe(
    Option.map((head) => {
      const tail = Arr.drop(segments, 1);
      if (tail.length === 0 && isRecord(obj)) {
        const { [head]: _, ...rest } = obj;
        return rest;
      }
      if (Array.isArray(obj)) {
        const idx = Number(head);
        if (Number.isNaN(idx)) return obj;
        const copy = [...obj];
        copy[idx] = deleteByPath(
          Arr.get(copy, idx).pipe(Option.getOrElse((): unknown => undefined)),
          tail,
        );
        return copy;
      }
      if (isRecord(obj)) {
        return { ...obj, [head]: deleteByPath(obj[head], tail) };
      }
      return obj;
    }),
    Option.getOrElse(() => obj),
  );
};

const flattenToLeaves = (
  obj: unknown,
  prefix: string,
): ReadonlyArray<{ key: string; value: unknown }> => {
  if (obj === null || obj === undefined) return [{ key: prefix, value: obj }];
  if (Array.isArray(obj)) {
    return Arr.flatMap(obj, (item, i) =>
      flattenToLeaves(item, prefix === "" ? String(i) : `${prefix}.${i}`),
    );
  }
  if (isRecord(obj)) {
    return Arr.flatMap(Object.entries(obj), ([k, v]) =>
      flattenToLeaves(v, prefix === "" ? k : `${prefix}.${k}`),
    );
  }
  return [{ key: prefix, value: obj }];
};

const unknownToYaml = (v: unknown): Yaml.YamlValue => {
  if (v === null || v === undefined) return Yaml.scalar(null);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return Yaml.scalar(v);
  if (Array.isArray(v)) return Yaml.list(Arr.map(v, unknownToYaml));
  if (isRecord(v))
    return Yaml.map(
      Arr.map(Object.entries(v), ([k, val]) => ({ key: k, value: unknownToYaml(val) })),
    );
  return Yaml.scalar(String(v));
};

const formatValue = (v: unknown) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return Yaml.prettyPrintDoc(Yaml.doc(unknownToYaml(v)));
  return String(v);
};

const readAndParseConfig = Effect.gen(function* () {
  const config = yield* Config;
  const raw = yield* config.readConfig;
  const parsed = Yaml.parse(raw);
  const plain = isRecord(parsed) ? parsed : {};
  return { config, plain };
});

const writeConfig = (configPath: string, validated: typeof MachineConfig.Type) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const yamlValue = configToYaml(validated);
    const content = Yaml.prettyPrintDoc(Yaml.doc(yamlValue)) + "\n";
    yield* fs.writeFileString(`${configPath}.tmp`, content);
    yield* fs.rename(`${configPath}.tmp`, configPath);
  });

const validateAndWrite = (updated: unknown, configPath: string) =>
  Schema.decodeUnknownEffect(MachineConfig)(updated).pipe(
    Effect.tap((validated) => writeConfig(configPath, validated)),
    Effect.tapError((e) =>
      Effect.gen(function* () {
        const output = yield* Output;
        yield* output.emit(
          Diagnostic({ severity: "error", message: `Validation failed: ${String(e)}` }),
        );
      }),
    ),
  );

const configGetCommand = Command.make(
  "get",
  {
    path: Argument.string("path").pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  ({ path: dotPath }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const { plain } = yield* readAndParseConfig;
      const segments = dotPath.split(".");
      const value = yield* getByPath(plain, segments).pipe(
        Effect.fromOption,
        Effect.mapError(() =>
          Diagnostic({ severity: "error", message: `Key not found: ${dotPath}` }),
        ),
        Effect.tapError((d) => output.emit(d)),
      );
      const emission =
        Array.isArray(value) && value.length > 0 && isRecord(value[0])
          ? Table({
              headers: Object.keys(value[0] as globalThis.Record<string, unknown>),
              rows: Arr.map(Arr.filter(value, isRecord), (obj) =>
                Arr.map(Object.keys(value[0] as globalThis.Record<string, unknown>), (k) =>
                  formatValue(obj[k]),
                ),
              ),
            })
          : isRecord(value)
            ? Record({
                fields: Arr.map(Object.entries(value), ([k, v]): readonly [string, string] => [
                  k,
                  formatValue(v),
                ]),
              })
            : Line({ text: formatValue(value) });
      yield* output.emit(emission);
    }).pipe(
      Effect.catch(() => Effect.void),
      Effect.provide(ConfigLayers),
    ),
);

const configSetCommand = Command.make(
  "set",
  {
    path: Argument.string("path").pipe(Argument.withSchema(Schema.NonEmptyString)),
    value: Argument.string("value").pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  ({ path: dotPath, value: rawValue }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const { config, plain } = yield* readAndParseConfig;
      const segments = dotPath.split(".");
      const oldDisplay = getByPath(plain, segments).pipe(
        Option.map(formatValue),
        Option.getOrElse(() => "null"),
      );
      const newValue = coerceValue(rawValue);
      const updated = setByPath(plain, segments, newValue);
      yield* validateAndWrite(updated, config.configPath);
      yield* output.emit(Line({ text: `${dotPath}: ${oldDisplay} → ${formatValue(newValue)}` }));
    }).pipe(Effect.provide(ConfigLayers)),
);

const configListCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    const { plain } = yield* readAndParseConfig;
    const leaves = flattenToLeaves(plain, "");
    yield* Effect.forEach(
      Arr.filter(leaves, (leaf) => typeof leaf.value !== "object" || leaf.value === null),
      (leaf) => output.emit(Record({ fields: [[leaf.key, formatValue(leaf.value)]] })),
    );
  }).pipe(Effect.provide(ConfigLayers)),
);

const configResetCommand = Command.make(
  "reset",
  {
    path: Argument.string("path").pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  ({ path: dotPath }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const loader = yield* MachineLoader;
      const { config, plain } = yield* readAndParseConfig;
      const preset = yield* loader.loadPreset("orchestrate");
      const segments = dotPath.split(".");
      const defaultValue = yield* getByPath(preset, segments).pipe(
        Effect.fromOption,
        Effect.mapError(() =>
          Diagnostic({ severity: "error", message: `No default found for: ${dotPath}` }),
        ),
        Effect.tapError((d) => output.emit(d)),
      );
      const oldDisplay = getByPath(plain, segments).pipe(
        Option.map(formatValue),
        Option.getOrElse(() => "null"),
      );
      const updated = setByPath(plain, segments, defaultValue);
      yield* validateAndWrite(updated, config.configPath);
      yield* output.emit(
        Line({
          text: `${dotPath}: ${oldDisplay} → ${formatValue(defaultValue)} (reset to default)`,
        }),
      );
    }).pipe(Effect.provide(ConfigLayers)),
);

const guardListCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    const { plain } = yield* readAndParseConfig;
    const guards = plain.guards;
    if (!Array.isArray(guards) || guards.length === 0) {
      yield* output.emit(Line({ text: "No guards configured." }));
      return;
    }
    const field = (rec: globalThis.Record<string, unknown>, key: string) =>
      Option.fromNullishOr(rec[key]).pipe(
        Option.map(String),
        Option.getOrElse(() => ""),
      );
    const guardFields = ["type", "enforced_by", "event", "matcher"] as const;
    yield* output.emit(
      Table({
        headers: ["TYPE", "ENFORCED_BY", "EVENT", "MATCHER", "ENABLED"],
        rows: Arr.map(guards, (g) =>
          isRecord(g)
            ? [...Arr.map(guardFields, (k) => field(g, k)), g.enabled === false ? "false" : "true"]
            : Arr.map([...guardFields, "enabled"], () => ""),
        ),
      }),
    );
  }).pipe(Effect.provide(ConfigLayers)),
);

const makeGuardToggleCommand = (
  label: string,
  applyToggle: (plain: Record<string, unknown>, idx: number) => unknown,
) =>
  Command.make(
    label,
    {
      name: Argument.string("name").pipe(Argument.withSchema(Schema.NonEmptyString)),
    },
    ({ name }) =>
      Effect.gen(function* () {
        const output = yield* Output;
        const { config, plain } = yield* readAndParseConfig;
        const guards = plain.guards;
        if (!Array.isArray(guards)) {
          yield* output.emit(Diagnostic({ severity: "error", message: "No guards configured." }));
          return;
        }
        const idx = Arr.findFirstIndex(guards, (g) => isRecord(g) && g.type === name);
        if (Option.isNone(idx)) {
          yield* output.emit(
            Diagnostic({ severity: "error", message: `Guard not found: ${name}` }),
          );
          return;
        }
        const updated = applyToggle(plain, idx.value);
        yield* validateAndWrite(updated, config.configPath);
        yield* output.emit(Line({ text: `${name}: ${label}d` }));
      }).pipe(Effect.provide(ConfigLayers)),
  );

const guardEnableCommand = makeGuardToggleCommand("enable", (plain, idx) =>
  deleteByPath(plain, ["guards", String(idx), "enabled"]),
);

const guardDisableCommand = makeGuardToggleCommand("disable", (plain, idx) =>
  setByPath(plain, ["guards", String(idx), "enabled"], false),
);

const guardSetCommand = Command.make(
  "set",
  {
    name: Argument.string("name").pipe(Argument.withSchema(Schema.NonEmptyString)),
    key: Argument.string("key").pipe(Argument.withSchema(Schema.NonEmptyString)),
    value: Argument.string("value").pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  ({ name, key, value: rawValue }) =>
    Effect.gen(function* () {
      const output = yield* Output;
      const { config, plain } = yield* readAndParseConfig;
      const guards = plain.guards;
      if (!Array.isArray(guards)) {
        yield* output.emit(Diagnostic({ severity: "error", message: "No guards configured." }));
        return;
      }
      const idx = Arr.findFirstIndex(guards, (g) => isRecord(g) && g.type === name);
      if (Option.isNone(idx)) {
        yield* output.emit(Diagnostic({ severity: "error", message: `Guard not found: ${name}` }));
        return;
      }
      const oldDisplay = getByPath(plain, ["guards", String(idx.value), key]).pipe(
        Option.map(formatValue),
        Option.getOrElse(() => "null"),
      );
      const newValue = coerceValue(rawValue);
      const updated = setByPath(plain, ["guards", String(idx.value), key], newValue);
      yield* validateAndWrite(updated, config.configPath);
      yield* output.emit(
        Line({ text: `${name}.${key}: ${oldDisplay} → ${formatValue(newValue)}` }),
      );
    }).pipe(Effect.provide(ConfigLayers)),
);

const guardParent = Command.make("guard", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(Line({ text: "Usage: anakmagang config guard <list|enable|disable|set>" }));
  }),
);

const guardCommand = Command.withSubcommands(guardParent, [
  guardListCommand,
  guardEnableCommand,
  guardDisableCommand,
  guardSetCommand,
]);

const configSummaryCommand = Command.make("summary", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    const { plain } = yield* readAndParseConfig;
    const field = (rec: globalThis.Record<string, unknown>, key: string, fallback = "") =>
      Option.fromNullishOr(rec[key]).pipe(
        Option.map(String),
        Option.getOrElse(() => fallback),
      );
    const arrField = (rec: globalThis.Record<string, unknown>, key: string) =>
      Array.isArray(rec[key]) ? (rec[key] as ReadonlyArray<unknown>) : [];

    const phases = plain.phases;
    if (Array.isArray(phases) && phases.length > 0) {
      yield* output.emit(Line({ text: "Phases" }));
      yield* output.emit(
        Table({
          headers: ["STATE", "NAME", "TRANSITION", "GUARD_QUESTION"],
          rows: Arr.map(Arr.filter(phases, isRecord), (p) => [
            field(p, "id"),
            field(p, "name"),
            field(p, "next", "—"),
            field(p, "exit_question"),
          ]),
        }),
      );
    }

    const guards = plain.guards;
    if (Array.isArray(guards) && guards.length > 0) {
      yield* output.emit(Line({ text: "\nGuards" }));
      yield* output.emit(
        Table({
          headers: ["GUARD", "ENFORCEMENT", "EVENT", "ENABLED"],
          rows: Arr.map(Arr.filter(guards, isRecord), (g) => [
            field(g, "type"),
            field(g, "enforced_by"),
            field(g, "event"),
            g.enabled === false ? "false" : "true",
          ]),
        }),
      );
    }

    const sizePresets = plain.size_presets;
    if (isRecord(sizePresets)) {
      yield* output.emit(Line({ text: "\nSize Presets" }));
      yield* output.emit(
        Table({
          headers: ["SIZE", "STATES", "SKIP", "CRITERIA"],
          rows: Arr.map(Object.entries(sizePresets), ([size, preset]) => {
            const p = isRecord(preset) ? preset : {};
            return [
              size,
              Arr.map(arrField(p, "phases"), String).join(", "),
              Arr.map(arrField(p, "skip"), String).join(", "),
              Arr.map(arrField(p, "criteria"), String).join("; "),
            ];
          }),
        }),
      );
    }
  }).pipe(Effect.provide(ConfigLayers)),
);

const configParent = Command.make("config", {}, () =>
  Effect.gen(function* () {
    const output = yield* Output;
    yield* output.emit(
      Line({ text: "Usage: anakmagang config <get|set|list|reset|guard|summary>" }),
    );
  }),
);

export const configCommand = Command.withSubcommands(configParent, [
  configGetCommand,
  configSetCommand,
  configListCommand,
  configResetCommand,
  guardCommand,
  configSummaryCommand,
]);
