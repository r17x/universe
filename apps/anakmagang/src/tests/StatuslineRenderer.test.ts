import { describe, test, expect } from "bun:test";
import { Option } from "effect";
import { renderStatusline } from "../StatuslineRenderer";
import type { HookInput } from "../guard";
import type { StatuslineConfigType } from "../MachineLoader";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const mkInput = (pct: number | null | undefined): HookInput => ({
  context_window: { used_percentage: pct },
});

const none = Option.none();

describe("renderStatusline", () => {
  describe("default rendering (config=undefined)", () => {
    test("no session state renders only percentage", () => {
      const result = renderStatusline(undefined, mkInput(42), none, false);
      expect(result).toEqual(["(42%)"]);
    });

    test("with task and phase renders all parts", () => {
      const result = renderStatusline(
        undefined,
        mkInput(42),
        Option.some({
          task: "some task",
          phase: "impl",
        }),
        false,
      );
      expect(result).toEqual(["(42%) | some task | phase:impl"]);
    });

    test("truncates task longer than 30 chars to 27 plus ellipsis", () => {
      const longTask = "a]".repeat(16).slice(0, 35);
      const result = renderStatusline(
        undefined,
        mkInput(10),
        Option.some({
          task: longTask,
          phase: "setup",
        }),
        false,
      );
      const parts = result[0].split(" | ");
      expect(parts[1]).toBe(longTask.slice(0, 27) + "...");
      expect(parts[1].length).toBe(30);
    });

    test("task exactly 30 chars is not truncated", () => {
      const exactTask = "x".repeat(30);
      const result = renderStatusline(
        undefined,
        mkInput(10),
        Option.some({
          task: exactTask,
          phase: "setup",
        }),
        false,
      );
      const parts = result[0].split(" | ");
      expect(parts[1]).toBe(exactTask);
    });

    test("null percentage renders as unknown", () => {
      const result = renderStatusline(undefined, mkInput(null), none, false);
      expect(result).toEqual(["(--)"]);
    });

    test("undefined percentage renders as unknown", () => {
      const result = renderStatusline(undefined, mkInput(undefined), none, false);
      expect(result).toEqual(["(--)"]);
    });

    test("task without phase omits phase segment", () => {
      const result = renderStatusline(
        undefined,
        mkInput(50),
        Option.some({
          task: "my task",
        }),
        false,
      );
      expect(result).toEqual(["(50%) | my task"]);
    });

    test("session ID prepended before percentage when present", () => {
      const result = renderStatusline(
        undefined,
        mkInput(0),
        Option.some({
          sessionId: "01KS2S71DTH3K235F6J05SK9YB",
          task: "Continue Praetorian gaps",
          phase: "implementation",
        }),
        false,
      );
      expect(result).toEqual([
        "01KS2S71DTH3K235F6J05SK9YB | (0%) | Continue Praetorian gaps | phase:implementation",
      ]);
    });

    test("session ID without task shows only ID and percentage", () => {
      const result = renderStatusline(
        undefined,
        mkInput(25),
        Option.some({
          sessionId: "01KS2S71DTH3K235F6J05SK9YB",
        }),
        false,
      );
      expect(result).toEqual(["01KS2S71DTH3K235F6J05SK9YB | (25%)"]);
    });

    test("no session ID behaves as before", () => {
      const result = renderStatusline(
        undefined,
        mkInput(42),
        Option.some({
          task: "some task",
          phase: "impl",
        }),
        false,
      );
      expect(result).toEqual(["(42%) | some task | phase:impl"]);
    });
  });

  describe("config-driven rendering", () => {
    test("single text segment renders formatted output", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "pct", source: "stdin.context_window.used_percentage", format: "{value}%" },
        ],
      };
      const result = renderStatusline(config, mkInput(42), none, false);
      expect(result).toEqual(["42%"]);
    });

    test("bar segment with thresholds renders ANSI colored bar", () => {
      const config: StatuslineConfigType = {
        segments: [
          {
            id: "bar",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 5,
            thresholds: [70, 90] as const,
          },
        ],
      };
      const result = renderStatusline(config, mkInput(50), none, false);
      expect(result[0]).toContain(GREEN);
      expect(result[0]).toContain(RESET);
      expect(result[0]).toContain("50%");
    });

    test("duration segment renders minutes and seconds", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "dur", source: "stdin.context_window.used_percentage", render: "duration" },
        ],
      };
      const result = renderStatusline(config, mkInput(125000), none, false);
      expect(result).toEqual(["2m 5s"]);
    });

    test("layout with multiple lines returns multiple strings", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "a", source: "stdin.context_window.used_percentage", format: "A:{value}" },
          { id: "b", source: "state.current_task", format: "B:{value}" },
        ],
        layout: [["a"], ["b"]],
      };
      const result = renderStatusline(config, mkInput(42), Option.some({ task: "hello" }), false);
      expect(result).toEqual(["A:42", "B:hello"]);
    });

    test("segments with null source are auto-hidden", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "a", source: "stdin.context_window.used_percentage", format: "A:{value}" },
          { id: "b", source: "state.current_task", format: "B:{value}" },
        ],
      };
      const result = renderStatusline(config, mkInput(42), none, false);
      expect(result).toEqual(["A:42"]);
    });

    test("preset filtering shows only active preset segments", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "a", source: "stdin.context_window.used_percentage", format: "A:{value}" },
          { id: "b", source: "state.current_task", format: "B:{value}" },
          { id: "c", source: "state.current_phase", format: "C:{value}" },
        ],
        presets: { minimal: ["a", "c"] },
        active: "minimal",
      };
      const result = renderStatusline(
        config,
        mkInput(42),
        Option.some({ task: "t", phase: "p" }),
        false,
      );
      expect(result).toEqual(["A:42 | C:p"]);
    });

    test("default separator is pipe with spaces", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "a", source: "stdin.context_window.used_percentage", format: "A" },
          { id: "b", source: "state.current_task", format: "B" },
        ],
      };
      const result = renderStatusline(config, mkInput(42), Option.some({ task: "t" }), false);
      expect(result).toEqual(["A | B"]);
    });

    test("state.session_id source resolves session ID", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "sid", source: "state.session_id", format: "SID:{value}" },
          { id: "pct", source: "stdin.context_window.used_percentage", format: "{value}%" },
        ],
      };
      const result = renderStatusline(
        config,
        mkInput(42),
        Option.some({
          sessionId: "01ABC",
          task: "t",
        }),
        false,
      );
      expect(result).toEqual(["SID:01ABC | 42%"]);
    });

    test("custom separator overrides default", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "a", source: "stdin.context_window.used_percentage", format: "A" },
          { id: "b", source: "state.current_task", format: "B" },
        ],
        separator: " :: ",
      };
      const result = renderStatusline(config, mkInput(42), Option.some({ task: "t" }), false);
      expect(result).toEqual(["A :: B"]);
    });
  });

  describe("web running indicator", () => {
    test("shows globe when web is running (default)", () => {
      const result = renderStatusline(undefined, mkInput(42), none, true);
      expect(result).toEqual(["\u{1F310} (42%)"]);
    });

    test("shows globe with session state when web is running", () => {
      const result = renderStatusline(
        undefined,
        mkInput(42),
        Option.some({
          task: "some task",
          phase: "impl",
        }),
        true,
      );
      expect(result).toEqual(["\u{1F310} (42%) | some task | phase:impl"]);
    });

    test("shows globe with config-driven rendering", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "pct", source: "stdin.context_window.used_percentage", format: "{value}%" },
        ],
      };
      const result = renderStatusline(config, mkInput(42), none, true);
      expect(result).toEqual(["\u{1F310} 42%"]);
    });
  });

  describe("edge cases", () => {
    test("empty segments array falls back to default", () => {
      const config: StatuslineConfigType = { segments: [] };
      const result = renderStatusline(config, mkInput(42), none, false);
      expect(result).toEqual(["(42%)"]);
    });

    test("deepGet resolves nested paths", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "tool", source: "stdin.tool_input.model.display_name", format: "{value}" },
        ],
      };
      const input: HookInput = {
        context_window: { used_percentage: 10 },
        tool_input: { model: { display_name: "claude-opus" } },
      };
      const result = renderStatusline(config, input, none, false);
      expect(result).toEqual(["claude-opus"]);
    });

    test("format string interpolates {value}", () => {
      const config: StatuslineConfigType = {
        segments: [
          { id: "a", source: "stdin.context_window.used_percentage", format: "CTX={value}pct" },
        ],
      };
      const result = renderStatusline(config, mkInput(55), none, false);
      expect(result).toEqual(["CTX=55pct"]);
    });

    test("bar at 0% renders green with 0%", () => {
      const config: StatuslineConfigType = {
        segments: [
          {
            id: "bar",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 5,
            thresholds: [70, 90] as const,
          },
        ],
      };
      const result = renderStatusline(config, mkInput(0), none, false);
      expect(result[0]).toContain(GREEN);
      expect(result[0]).toContain("0%");
      expect(result[0]).toContain("░░░░░");
    });

    test("bar at 69% renders green", () => {
      const config: StatuslineConfigType = {
        segments: [
          {
            id: "bar",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 10,
            thresholds: [70, 90] as const,
          },
        ],
      };
      const result = renderStatusline(config, mkInput(69), none, false);
      expect(result[0]).toContain(GREEN);
      expect(result[0]).toContain("69%");
    });

    test("bar at 70% renders yellow", () => {
      const config: StatuslineConfigType = {
        segments: [
          {
            id: "bar",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 10,
            thresholds: [70, 90] as const,
          },
        ],
      };
      const result = renderStatusline(config, mkInput(70), none, false);
      expect(result[0]).toContain(YELLOW);
      expect(result[0]).toContain("70%");
    });

    test("bar at 90% renders red", () => {
      const config: StatuslineConfigType = {
        segments: [
          {
            id: "bar",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 10,
            thresholds: [70, 90] as const,
          },
        ],
      };
      const result = renderStatusline(config, mkInput(90), none, false);
      expect(result[0]).toContain(RED);
      expect(result[0]).toContain("90%");
    });

    test("bar at 100% renders red", () => {
      const config: StatuslineConfigType = {
        segments: [
          {
            id: "bar",
            source: "stdin.context_window.used_percentage",
            render: "bar",
            width: 10,
            thresholds: [70, 90] as const,
          },
        ],
      };
      const result = renderStatusline(config, mkInput(100), none, false);
      expect(result[0]).toContain(RED);
      expect(result[0]).toContain("100%");
      expect(result[0]).toContain("██████████");
    });
  });
});
