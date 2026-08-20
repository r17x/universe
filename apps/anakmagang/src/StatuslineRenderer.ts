import { Array as Arr, Option } from "effect";
import type { HookInput } from "./guard";
import type { StatuslineConfigType } from "./MachineLoader";
import { computeContextPct } from "./protocol.GuardConfig";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export interface SessionSnapshot {
  readonly sessionId?: string | undefined;
  readonly task?: string | undefined;
  readonly phase?: string | undefined;
}

export const deepGet = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

export const resolveSource = (
  source: string,
  input: HookInput,
  state: Option.Option<SessionSnapshot>,
): unknown => {
  if (source.startsWith("stdin.")) {
    return deepGet(input, source.slice(6));
  }
  if (source.startsWith("state.")) {
    const field = source.slice(6);
    const extract = (s: SessionSnapshot): string | undefined =>
      field === "current_phase"
        ? s.phase
        : field === "current_task"
          ? s.task
          : field === "session_id"
            ? s.sessionId
            : undefined;
    return Option.getOrUndefined(Option.flatMap(state, (s) => Option.fromNullishOr(extract(s))));
  }
  return undefined;
};

export const formatNumber = (value: number, format?: string): string => {
  if (format?.includes(":.2f")) return value.toFixed(2);
  if (format?.includes(":.0f")) return Math.round(value).toString();
  return value.toString();
};

export const formatValue = (value: unknown, format: string | undefined): string => {
  if (value === null || value === undefined) return "";
  const str = typeof value === "number" ? formatNumber(value, format) : String(value);
  return format ? format.replace("{value}", str) : str;
};

export const renderBar = (
  value: number,
  width: number,
  thresholds: readonly [number, number] | undefined,
): string => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.floor((pct * width) / 100);
  const bar = Arr.makeBy(width, (i) => (i < filled ? "█" : "░")).join("");
  const [warn, critical] = thresholds ?? [70, 90];
  const color = pct >= critical ? RED : pct >= warn ? YELLOW : GREEN;
  return `${color}${bar}${RESET} ${pct}%`;
};

export const renderDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${secs}s`;
};

export interface SegmentDef {
  readonly id: string;
  readonly source: string;
  readonly format?: string | undefined;
  readonly render?: "text" | "bar" | "duration" | undefined;
  readonly width?: number | undefined;
  readonly thresholds?: readonly [number, number] | undefined;
}

export const renderSegment = (
  segment: SegmentDef,
  input: HookInput,
  state: Option.Option<SessionSnapshot>,
): string | undefined => {
  const raw = resolveSource(segment.source, input, state);
  if (raw === null || raw === undefined) return undefined;

  const mode = segment.render ?? "text";
  const rendered =
    mode === "bar" && typeof raw === "number"
      ? renderBar(raw, segment.width ?? 10, segment.thresholds)
      : mode === "duration" && typeof raw === "number"
        ? renderDuration(raw)
        : formatValue(raw, segment.format);
  return rendered;
};

export const renderDefault = (
  input: HookInput,
  state: Option.Option<SessionSnapshot>,
  webRunning: boolean,
): string[] => {
  const rawPct = computeContextPct(input.context_window);
  const pctStr = typeof rawPct === "number" ? `${Math.round(rawPct)}%` : "--";
  return Option.match(state, {
    onNone: () => {
      const line = `(${pctStr})`;
      return [webRunning ? `🌐 ${line}` : line];
    },
    onSome: (s) => {
      const parts = [
        ...(s.sessionId !== undefined ? [s.sessionId] : []),
        `(${pctStr})`,
        ...(s.task !== undefined
          ? [s.task.length > 30 ? s.task.slice(0, 27) + "..." : s.task]
          : []),
        ...(s.phase !== undefined ? [`phase:${s.phase}`] : []),
      ];
      const line = Arr.join(parts, " | ");
      return [webRunning ? `🌐 ${line}` : line];
    },
  });
};

export const renderFromConfig = (
  config: StatuslineConfigType,
  input: HookInput,
  state: Option.Option<SessionSnapshot>,
  webRunning: boolean,
): string[] => {
  const allSegments = config.segments ?? [];
  const separator = config.separator ?? " | ";

  const presetDef = config.active !== undefined ? config.presets?.[config.active] : undefined;
  const activeIds: ReadonlyArray<string> | "all" = Array.isArray(presetDef) ? presetDef : "all";

  const filteredSegments =
    activeIds === "all"
      ? allSegments
      : Arr.filter(allSegments, (s) => Arr.contains(activeIds, s.id));

  const layout = config.layout;
  if (layout !== undefined && layout.length > 0) {
    const layoutLines = Arr.filter(
      Arr.map(layout, (lineIds) => {
        const lineSegments = Arr.filter(
          Arr.map(
            Arr.filter(
              Arr.map(lineIds, (id) => filteredSegments.find((s) => s.id === id)),
              (s): s is NonNullable<typeof s> => s !== undefined,
            ),
            (s) => renderSegment(s, input, state),
          ),
          (v): v is string => v !== undefined && v !== "",
        );
        return lineSegments.join(separator);
      }),
      (line) => line !== "",
    );
    return webRunning && layoutLines.length > 0
      ? ["\u{1F310} " + layoutLines[0], ...layoutLines.slice(1)]
      : layoutLines;
  }

  const rendered = Arr.filter(
    Arr.map(filteredSegments, (s) => renderSegment(s, input, state)),
    (v): v is string => v !== undefined && v !== "",
  );
  const lines = rendered.length > 0 ? [rendered.join(separator)] : [];
  return webRunning && lines.length > 0 ? ["\u{1F310} " + lines[0], ...lines.slice(1)] : lines;
};

export const renderStatusline = (
  config: StatuslineConfigType | undefined,
  input: HookInput,
  state: Option.Option<SessionSnapshot>,
  webRunning: boolean,
): string[] =>
  config?.segments !== undefined && config.segments.length > 0
    ? renderFromConfig(config, input, state, webRunning)
    : renderDefault(input, state, webRunning);
